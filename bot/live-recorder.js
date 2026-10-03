const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_MS = parseInt(process.env.MAX_RECORDING_MS || 18000000, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startRecorder(outputPath, durationSeconds) {
  const display = process.env.DISPLAY || ':99';
  const pulseSource = process.env.PULSE_CAPTURE_SOURCE || 'teams_sink.monitor';

  const args = [
    '-y',
    '-thread_queue_size', '4096',
    '-f', 'x11grab',
    '-draw_mouse', '0',
    '-video_size', process.env.RECORDING_SIZE || '1280x805',
    '-framerate', process.env.RECORDING_FPS || '15',
    '-i', display,
    '-thread_queue_size', '4096',
    '-f', 'pulse',
    '-i', pulseSource,
    '-t', String(durationSeconds),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-vf', 'crop=836:560:76:200',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', process.env.FFMPEG_AUDIO_BITRATE || '128k',
    '-movflags', '+faststart',
    outputPath
  ];

  console.log(`[FFMPEG] Starting capture: ${outputPath}`);
  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', d => process.stdout.write(d));
  proc.stderr.on('data', d => process.stderr.write(d));

  return proc;
}

async function stopRecorder(proc) {
  return new Promise((resolve) => {
    if (!proc || proc.killed) return resolve();
    proc.on('close', () => resolve());
    proc.kill('SIGINT');
    setTimeout(() => {
      if (!proc.killed) proc.kill('SIGKILL');
      resolve();
    }, 5000);
  });
}

async function recordLiveClass(url, outputPath, cookies, options = {}) {
  const maxMs = options.maxMs || MAX_MS;
  let browser;
  let ffmpeg;

  try {
    browser = await chromium.launch({
      headless: false,
      channel: 'chrome',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1280,805',
        '--app=data:text/html,<html></html>',
        '--kiosk',
        '--start-fullscreen',
        '--window-position=0,0',
        '--disable-infobars',
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
        '--use-file-for-fake-audio-capture=' + path.resolve(__dirname, 'silence.wav')
      ]
    });

    const context = await browser.newContext({
      viewport: null,
      permissions: ['microphone', 'camera']
    });

    if (Array.isArray(cookies) && cookies.length) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.on('console', msg => console.log(`[Teams Live] ${msg.text()}`));

    console.log('[DEBUG] Opening Teams Live Meeting...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(5000);

    // 1. Bypass "How do you want to join your Teams meeting?"
    try {
        const joinOnWeb = page.locator('button[data-tid="joinOnWeb"], [data-tid="joinOnWeb"], button:has-text("Continue on this browser")').first();
        if (await joinOnWeb.isVisible({ timeout: 10000 })) {
            console.log('[DEBUG] Clicking "Continue on this browser"');
            await joinOnWeb.click({ force: true });
            await page.waitForTimeout(5000);
        }
    } catch(e) {}

    // 2. Pre-join screen (Turn off Mic/Cam, Click Join Now)
    try {
        // Wait for pre-join screen to load
        await page.waitForSelector('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")', { timeout: 30000 });
        console.log('[DEBUG] Pre-join screen loaded.');
        
        await page.waitForTimeout(3000); // Give toggles time to initialize state
        // Attempt to clear any Unified Consent or cookie popups
        try {
            console.log('[DEBUG] Checking for consent iframes...');
            await page.keyboard.press('Escape'); // First try to just escape it
            await page.waitForTimeout(1000);
            
            const consentFrame = page.frameLocator('[data-tid="hosted-content-iframe"]');
            if (await consentFrame.locator('body').isVisible({ timeout: 4000 })) {
                console.log('[DEBUG] Found consent iframe. Waiting for its content to render...');
                await page.waitForTimeout(3000); // give the iframe's React app time to mount
                
                const buttons = consentFrame.locator('button, [role="button"]');
                const count = await buttons.count();
                console.log('[DEBUG] Found ' + count + ' buttons in the iframe.');
                
                if (count > 0) {
                    await buttons.last().click({ timeout: 3000, force: true });
                    console.log('[DEBUG] Clicked the last button in the iframe.');
                } else {
                    console.log('[DEBUG] No buttons found in iframe. Pressing Tab+Enter...');
                    await consentFrame.locator('body').click({ force: true });
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Enter');
                }
                await page.waitForTimeout(2000);
                
                // If the iframe wrapper is still intercepting, let's aggressively nuke it from the DOM
                console.log('[DEBUG] Nuking the iframe wrapper from the DOM just in case.');
                await page.evaluate(() => {
                    const iframe = document.querySelector('[data-tid="hosted-content-iframe"]');
                    if (iframe) {
                        const wrapper = iframe.closest('div');
                        if (wrapper) {
                            wrapper.style.display = 'none';
                            wrapper.style.pointerEvents = 'none';
                        }
                        iframe.style.display = 'none';
                    }
                });
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('[DEBUG] Consent iframe handling error or not present:', e.message);
        }


        // If cookies are invalid, Teams might ask for a guest name before enabling the Join button
        try {
            const nameInput = page.locator('input[data-tid="prejoin-display-name-input"]');
            if (await nameInput.isVisible({ timeout: 2000 })) {
                console.log('[DEBUG] Guest name input found. Typing name to enable Join button...');
                await nameInput.fill('Class Bot');
                await page.waitForTimeout(1000);
            }
        } catch (e) {}

        // Ensure mic is muted
        try {
            console.log('[DEBUG] Checking if Mic is ON on prejoin...');
            const isMicOn = await page.evaluate(() => {
                const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    (el.getAttribute('data-tid') === 'toggle-mute') ||
                    (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('microphone'))
                );
                for (let btn of micBtns) {
                    if (btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('data-state') === 'unmuted') {
                        return true;
                    }
                    if (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').toLowerCase().includes('mute') && !btn.getAttribute('aria-label').toLowerCase().includes('unmute')) {
                        return true; // it says "Mute microphone", meaning it is unmuted
                    }
                }
                return false;
            });
            
            if (isMicOn) {
                console.log('[DEBUG] Mic is ON! Pressing Ctrl+Shift+M to mute...');
                await page.keyboard.press('Control+Shift+M');
                await page.waitForTimeout(1000);
            }
        } catch(e) {
            console.log('[DEBUG] Mic toggle error on prejoin', e.message);
        }

        // Ensure camera is off
        try {
            console.log('[DEBUG] Searching for Camera toggle on prejoin...');
            await page.evaluate(() => {
                const camBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    (el.getAttribute('data-tid') === 'toggle-video') ||
                    (el.getAttribute('aria-label') && (el.getAttribute('aria-label').toLowerCase().includes('camera') || el.getAttribute('aria-label').toLowerCase().includes('video')))
                );
                for (let btn of camBtns) {
                    if (btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('data-state') === 'unmuted') {
                        btn.click();
                    }
                }
            });
            await page.waitForTimeout(1000);
        } catch(e) {
            console.log('[DEBUG] Cam toggle error on prejoin', e.message);
        }

        console.log('[DEBUG] Clicking "Join now"');
        const joinBtn = page.locator('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")').first();
        await joinBtn.click({ timeout: 10000, force: true });
        
        await page.waitForTimeout(2000);
        if (await joinBtn.isVisible()) {
             console.log('[DEBUG] Join button still visible, trying Enter key...');
             await joinBtn.focus();
             await page.keyboard.press('Enter');
        }
    } catch(e) {
        console.log('[DEBUG] Pre-join button not found, maybe already joined or login blocked.', e.message);
    }

    await page.waitForTimeout(10000);

    // Double check mic is muted inside the meeting
    try {
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = await inMeetingMic.getAttribute('aria-label');
            const isUnmuted = ariaChecked === 'true' || (ariaLabel && ariaLabel.toLowerCase().includes('mute') && !ariaLabel.toLowerCase().includes('unmute'));
            
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now!');
                // Try keyboard shortcut first (Ctrl+Shift+M) as it is very reliable
                await page.keyboard.press('Control+Shift+M');
                await page.waitForTimeout(1000);
                
                // If still unmuted by checking state, try clicking it
                const stillUnmuted = await inMeetingMic.getAttribute('aria-checked') === 'true';
                if (stillUnmuted) {
                     await inMeetingMic.click({ force: true });
                }
            }
        } else {
            // Just blind fire Ctrl+Shift+M just in case we couldn't find the button but it's on
            console.log('[DEBUG] Mic button not found, blind firing Ctrl+Shift+M to mute...');
            await page.keyboard.press('Control+Shift+M');
        }
    } catch(e) {}

    // Open Roster / Participants to monitor Organizer
    try {
        const rosterBtn = page.locator('button[id="roster-button"], button[aria-label="Participants"]');
        if (await rosterBtn.isVisible({ timeout: 5000 })) {
            await rosterBtn.click();
            console.log('[DEBUG] Opened Participants list.');
        }
    } catch (e) {}

    // Hide UI
    try {
      await page.keyboard.press('F11');
      
      const injectHider = async (frame) => {
        try {
          await frame.evaluate(() => {
            const style = document.createElement('style');
            style.innerHTML = "* { cursor: none !important; }";
            document.head.appendChild(style);

            setInterval(() => {
                try {
                    // Hide Top Header
                    const searchInput = document.querySelector('input[placeholder*="Ctrl+Alt+G"], input[placeholder*="Type"], input[id*="search"]');
                    if (searchInput) {
                        let parent = searchInput.parentElement;
                        for(let i = 0; i < 15; i++) {
                            if (parent && parent.tagName !== 'BODY') {
                                const r = parent.getBoundingClientRect();
                                if (r.height < 120 && r.width > window.innerWidth * 0.4 && r.top <= 0) {
                                    parent.style.setProperty('display', 'none', 'important');
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }

                    // Hide Left App Bar
                    const activityBtn = document.querySelector('button[aria-label="Activity"], button[name="Activity"], button[aria-label="Chat"]');
                    if (activityBtn) {
                        let parent = activityBtn.parentElement;
                        for(let i = 0; i < 15; i++) {
                            if (parent && parent.tagName !== 'BODY') {
                                const r = parent.getBoundingClientRect();
                                if (r.width < 120 && r.height > window.innerHeight * 0.4 && r.left <= 0) {
                                    parent.style.setProperty('display', 'none', 'important');
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }

                    // Hide Meeting Controls
                    const peopleBtn = document.querySelector('button[aria-label="People"], button[aria-label="Raise"], button[aria-label="View"], button[aria-label="React"]');
                    if (peopleBtn) {
                        let toolbar = peopleBtn.parentElement;
                        for (let i = 0; i < 12; i++) {
                            if (toolbar && toolbar.tagName !== 'BODY') {
                                const r = toolbar.getBoundingClientRect();
                                if (r.width > 200 && r.height < 150) {
                                    toolbar.style.setProperty('opacity', '0', 'important');
                                    toolbar.style.setProperty('pointer-events', 'none', 'important');
                                    break;
                                }
                                toolbar = toolbar.parentElement;
                            }
                        }
                    }

                    // Hide Participants Pane visually
                    const shareBtn = document.querySelector('button[aria-label*="Share invite"], input[placeholder*="Type a name"]');
                    if (shareBtn) {
                        let pane = shareBtn.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (pane && pane.tagName !== 'BODY') {
                                const r = pane.getBoundingClientRect();
                                if (r.width >= 200 && r.width <= 500 && r.height > window.innerHeight * 0.3) {
                                    pane.style.setProperty('opacity', '0.01', 'important');
                                    pane.style.setProperty('position', 'absolute', 'important');
                                    pane.style.setProperty('right', '-9999px', 'important');
                                    pane.style.setProperty('z-index', '-1', 'important');
                                    break;
                                }
                                pane = pane.parentElement;
                            }
                        }
                    }

                    // Force the video stage
                    const video = document.querySelector('video');
                    if (video) {
                        let stage = video.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (stage && stage.tagName !== 'BODY') {
                                const r = stage.getBoundingClientRect();
                                if (r.width > window.innerWidth * 0.3 && r.height > window.innerHeight * 0.3) {
                                    stage.style.setProperty('position', 'fixed', 'important');
                                    stage.style.setProperty('top', '0', 'important');
                                    stage.style.setProperty('left', '0', 'important');
                                    stage.style.setProperty('width', '100vw', 'important');
                                    stage.style.setProperty('height', '100vh', 'important');
                                    stage.style.setProperty('z-index', '999', 'important');
                                    stage.style.setProperty('background', '#000', 'important');
                                    stage.style.setProperty('padding', '0', 'important');
                                    stage.style.setProperty('margin', '0', 'important');
                                    break; 
                                }
                                stage = stage.parentElement;
                            }
                        }
                    }
                } catch (err) {}
            }, 1000);
          });
        } catch(e) {}
      };

      // Inject into main page and all current iframes
      for (const frame of page.frames()) {
          await injectHider(frame);
      }
      
      // Also inject into any newly created iframes dynamically
      page.on('frameattached', async (frame) => {
          await injectHider(frame);
      });

    } catch(e) {}
    await page.mouse.move(0, 0);

    // Start FFmpeg
    console.log('🎥 Starting FFmpeg recording for live class...');
    const recordMs = maxMs;
    ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000));

    const startTime = Date.now();
    let loopCount = 0;
    let maxParticipants = 0;
      const recentCounts = [];
    
    while (Date.now() - startTime < recordMs) {
      await sleep(15000); // Check every 15 seconds
      loopCount++;

      // Anti-idle
      if (loopCount % 20 === 0) {
        try {
          await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 500);
          await sleep(500);
          await page.mouse.move(0, 0);
        } catch (e) {}
      }
      
      // End meeting detection
      try {
        const stats = await page.evaluate(() => {
            const text = document.body.textContent || "";
            let ended = false;
            let currentCount = 0;
            
            if (text.includes("The meeting has ended") || text.includes("was ended") || text.includes("You've left the meeting")) {
                ended = true;
            }
            
            // Check if bot is completely alone
            if (text.includes("In this meeting (1)") || text.includes("Waiting for others to join")) {
                ended = true;
                currentCount = 1;
            }
            
            // Extract participant count
            const match = text.match(/In this meeting \((\d+)\)/);
            if (match) {
                currentCount = parseInt(match[1], 10);
            }
            
            return { ended, currentCount, text };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        if (currentCount > maxParticipants) {
            maxParticipants = currentCount;
        }
        
        if (currentCount > 0) {
            recentCounts.push(currentCount);
            if (recentCounts.length > 8) recentCounts.shift();
        }

        if (loopCount > 20 && recentCounts.length >= 4) {
            const recentMax = Math.max(...recentCounts);
            if (recentMax > 5) {
                if (currentCount <= Math.ceil(recentMax * 0.60)) {
                    console.log(`[DEBUG] Sudden mass exodus detected! Recent max was ${recentMax}, now ${currentCount}. Ending meeting.`);
                    meetingEnded = true;
                }
            } else if (recentMax > 1 && recentMax <= 5) {
                if (currentCount <= 2 && currentCount < recentMax) {
                    console.log(`[DEBUG] Small meeting drop detected! Recent max was ${recentMax}, now ${currentCount}. Ending meeting.`);
                    meetingEnded = true;
                }
            }
        }

        if (meetingEnded) {
          console.log('🏁 Meeting ended screen or Organizer departure detected. Stopping recording early.');
          break;
        }
      } catch (err) {}
    }

    await stopRecorder(ffmpeg);
    ffmpeg = null;

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
      throw new Error('Recording file was not created or is empty.');
    }

    console.log(`✅ Live recording saved: ${outputPath}`);
    return { outputPath, durationRecordedMs: Date.now() - startTime };
  } finally {
    if (ffmpeg) await stopRecorder(ffmpeg).catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = recordLiveClass;
