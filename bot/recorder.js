const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function runFfmpeg(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.stdout.on('data', d => process.stdout.write(d));
    proc.on('error', reject);
    proc.on('close', code => code === 0 ? resolve() : reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-4000)}`)));
  });
}

async function startRecorder(outputPath, maxMs) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const durationSeconds = Math.max(1, Math.floor(maxMs / 1000));
  const display = process.env.DISPLAY || ':99';
  const pulseSource = process.env.PULSE_CAPTURE_SOURCE || 'teams_sink.monitor';

  // Capture the virtual X display and the monitor of the dedicated PulseAudio sink.
  // The workflow creates both before starting this Node process.
  const args = [
    '-y',
    '-thread_queue_size', '4096',
    '-f', 'x11grab',
    '-draw_mouse', '0',
    '-video_size', process.env.RECORDING_SIZE || '1280x720',
    '-framerate', process.env.RECORDING_FPS || '15',
    '-i', display,
    '-thread_queue_size', '4096',
    '-f', 'pulse',
    '-i', pulseSource,
    '-t', String(durationSeconds),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', process.env.FFMPEG_AUDIO_BITRATE || '128k',
    '-movflags', '+faststart',
    outputPath
  ];

  console.log(`🎥 Starting capture: ${outputPath}`);
  console.log(`   DISPLAY=${display}`);
  console.log(`   PULSE_CAPTURE_SOURCE=${pulseSource}`);
  console.log(`   max duration=${durationSeconds}s`);

  const proc = spawn('ffmpeg', args, { stdio: ['ignore', 'pipe', 'pipe'] });
  proc.stdout.on('data', d => process.stdout.write(d));
  proc.stderr.on('data', d => process.stderr.write(d));

  return proc;
}

async function stopRecorder(proc) {
  if (!proc || proc.exitCode !== null) return;
  proc.kill('SIGINT');
  await new Promise(resolve => {
    const timer = setTimeout(() => {
      try { proc.kill('SIGKILL'); } catch (_) {}
      resolve();
    }, 15000);
    proc.once('close', () => { clearTimeout(timer); resolve(); });
  });
}

async function clickPlay(page) {
  // Use exact matches to avoid clicking "Playlist" in SharePoint sidebar
  const selectors = [
    'button[aria-label="Play" i]',
    'button[aria-label="Play video" i]',
    '[role="button"][aria-label="Play" i]',
    'button[title="Play" i]',
    'button[data-tid="play-button"]'
  ];

  for (const selector of selectors) {
    try {
      const locator = page.locator(selector).first();
      if (await locator.isVisible({ timeout: 1500 })) {
        await locator.click({ timeout: 3000 });
        console.log(`▶️ Clicked playback control: ${selector}`);
        return true;
      }
    } catch (_) {}
  }

  // If Teams exposes a native HTML5 video element, request playback through
  // the page's normal playback API. This does not download or extract the file.
  try {
    const played = await page.evaluate(() => {
      const videos = Array.from(document.querySelectorAll('video'));
      const video = videos.find(v => v.readyState >= 2) || videos[0];
      if (!video) return false;
      video.muted = false;
      const p = video.play();
      return p && typeof p.then === 'function' ? true : true;
    });
    if (played) {
      console.log('▶️ Requested playback on HTML5 video element.');
      return true;
    }
  } catch (_) {}

  return false;
}

async function waitForPlayback(page, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    try {
      const info = await page.evaluate(() => {
        const videos = Array.from(document.querySelectorAll('video'));
        const v = videos.find(x => !x.paused && x.currentTime > 0) || videos.find(x => x.readyState >= 2);
        if (!v) return { found: false };
        return { found: true, playing: !v.paused, currentTime: v.currentTime, duration: v.duration };
      });
      if (info.found && (info.playing || info.currentTime > 0)) return info;
    } catch (_) {}
    await sleep(1000);
  }
  return null;
}

async function recordClass(url, outputPath, cookies, options = {}) {
  const maxMs = options.maxMs || Number(process.env.MAX_RECORDING_MS || 7200000);
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
        '--window-size=1280,720',
        '--kiosk',
        '--start-fullscreen',
        '--disable-infobars',
        '--disable-background-timer-throttling',
        '--disable-backgrounding-occluded-windows',
        '--disable-renderer-backgrounding'
      ]
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1
    });

    if (Array.isArray(cookies) && cookies.length) {
      await context.addCookies(cookies);
    }

    const page = await context.newPage();
    page.on('console', msg => console.log(`[Teams] ${msg.text()}`));
    page.on('pageerror', err => console.log(`[Teams pageerror] ${err.message}`));

    console.log('[DEBUG] Warming up MS Teams session to refresh SSO tokens...');
    await page.goto('https://teams.microsoft.com', { waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(5000);

    console.log('?? Opening Teams recording...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(8000);

    if (/login|signin|authorize/i.test(page.url())) {
      console.log('[DEBUG] Hit login page during recording. Attempting to bypass SSO or re-enter credentials...');
      try {
        const bodyText = await page.locator('body').innerText();
        console.log('[DEBUG] Screen text:', bodyText.substring(0, 300).replace(/\n/g, ' '));
        
        // Handle Email if asked
        const emailInput = page.locator('input[type="email"], input[name="loginfmt"]');
        if (options.creds && options.creds.email && await emailInput.isVisible({ timeout: 2000 })) {
          console.log('[DEBUG] Email requested, filling...');
          await emailInput.fill(options.creds.email);
          await page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first().click();
          await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        }

        // Handle "Pick an account"
        const accountTile = page.locator('.tile-container, .table').first();
        if (await accountTile.isVisible({ timeout: 3000 })) {
          console.log('[DEBUG] Found account tile, clicking...');
          await accountTile.click();
          await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        }

        // Handle password if asked again
        const passInput = page.locator('input[type="password"]');
        if (options.creds && options.creds.password && await passInput.isVisible({ timeout: 5000 })) {
          console.log('[DEBUG] Password requested again, filling...');
          await passInput.fill(options.creds.password);
          await page.locator('input[type="submit"], button[type="submit"], #idSIButton9').first().click();
          await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        }

        // Handle "Stay signed in?"
        const kmsiYes = page.locator('input[id="idSIButton9"], input[value="Yes"]');
        if (await kmsiYes.isVisible({ timeout: 5000 })) {
          console.log('[DEBUG] Clicking Yes on Stay Signed In...');
          await kmsiYes.click();
          await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        }

        // Handle "Let's keep your account secure" (MFA Setup) skip button
        const skipBtn = page.locator('#btnAskLater, a:has-text("Skip"), a:has-text("Cancel")').first();
        if (await skipBtn.isVisible({ timeout: 3000 })) {
          console.log('[DEBUG] Found Skip/Cancel button for MFA setup, clicking...');
          await skipBtn.click();
          await page.waitForNavigation({ timeout: 15000 }).catch(() => {});
        }
      } catch (e) {
        console.log('[DEBUG] SSO bypass attempts finished or skipped.', e.message);
      }
      
      await page.waitForTimeout(5000);
      
      if (/login|signin|authorize/i.test(page.url())) {
        console.log('[DEBUG] Still stuck on login page. Capturing visual debugger screenshot...');
        if (options.onAuthError) {
          try {
            const screenshotBuffer = await page.screenshot({ fullPage: false });
            const base64Image = "data:image/png;base64," + screenshotBuffer.toString('base64');
            await options.onAuthError(base64Image);
          } catch (scrErr) {
            console.log('[DEBUG] Failed to take screenshot', scrErr);
          }
        }
        let reason = "Unknown login prompt";
        try {
            const finalBody = await page.locator('body').innerText();
            const cleanText = finalBody.replace(/\s+/g, ' ').trim();
            if (cleanText.includes("Let's keep your account secure") || cleanText.includes("more information required")) {
                reason = "Microsoft is demanding MFA/Security Info Setup (Verify phone/app in incognito).";
            } else if (cleanText.includes("Enter password")) {
                reason = "Password rejected or expired.";
            } else if (cleanText.includes("Approve sign in")) {
                reason = "Stuck waiting for Microsoft Authenticator app approval.";
            } else {
                reason = cleanText.substring(0, 100) + "...";
            }
        } catch(e) {}
        
        throw new Error(`Teams Login Blocked: ${reason} (Re-login from the dashboard)`);
      }
    }

    await page.bringToFront();

    const clicked = await clickPlay(page);

    // Try to enter fullscreen to avoid recording UI elements
    try {
      await page.keyboard.press('f'); // Generic fullscreen hotkey
      const fsSelectors = [
        'button[aria-label="Full screen" i]',
        'button[aria-label="Fullscreen" i]',
        'button[title="Full screen" i]',
        'button[title="Fullscreen" i]',
        'button[data-automation-id="fullscreen-button" i]'
      ];
      for (const fsSel of fsSelectors) {
        const fsLoc = page.locator(fsSel).first();
        if (await fsLoc.isVisible({ timeout: 1000 })) {
          await fsLoc.click({ timeout: 2000 });
          break;
        }
      }
    } catch (_) {}

    const playback = await waitForPlayback(page, 15000);
    if (!clicked && !playback) {
      throw new Error('Could not start Teams playback. Check the recording URL and saved Teams session.');
    }

    const resumeTime = options.resumeTime || 0;
    if (resumeTime > 0) {
      console.log(`⏩ Forwarding video to ${resumeTime} seconds...`);
      await page.evaluate((sec) => {
        const v = Array.from(document.querySelectorAll('video')).find(x => x.readyState >= 2) || document.querySelector('video');
        if (v) v.currentTime = sec;
      }, resumeTime);
      await sleep(8000); // Wait for buffer after seek
    }

    // Refetch duration to determine if we need to chunk
    const actualDuration = await page.evaluate(() => {
      const v = Array.from(document.querySelectorAll('video')).find(x => x.readyState >= 2) || document.querySelector('video');
      return v ? v.duration : 0;
    });

    const CHUNK_LIMIT_MS = 14400 * 1000; // 4 hours in ms
    let timeLeftMs = maxMs; 
    if (actualDuration > 0) {
      timeLeftMs = Math.max(0, (actualDuration - resumeTime) * 1000);
    }
    
    let recordMs = maxMs;
    let wasSplit = false;
    
    if (timeLeftMs > CHUNK_LIMIT_MS) {
      recordMs = CHUNK_LIMIT_MS;
      wasSplit = true;
      console.log(`✂️ Video has ${(timeLeftMs/3600000).toFixed(1)}h left. Chunking to 4 hours.`);
    } else {
      recordMs = Math.min(timeLeftMs, maxMs);
    }

    // Start capture
    ffmpeg = await startRecorder(outputPath, recordMs);

    console.log('⏺️ Recording in progress...');
    await sleep(5000); // Wait a bit for playback to stabilize

    // Smart monitoring loop instead of a blind sleep
    const startTime = Date.now();
    let loopCount = 0;
    while (Date.now() - startTime < recordMs) {
      await sleep(10000); // check every 10 seconds
      loopCount++;

      // Anti-Idle: Move mouse randomly every 5 minutes to prevent MS Teams "Are you still watching?" popup
      if (loopCount % 30 === 0) {
        try {
          await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 500);
        } catch (e) {}
      }
      
      try {
        const isEnded = await page.evaluate(() => {
          const videos = Array.from(document.querySelectorAll('video'));
          const v = videos.find(x => x.currentTime > 0) || videos[0];
          if (!v) return false;
          // Video is considered ended if it hit the 'ended' state, or it's paused near the end
          return v.ended || (v.paused && v.currentTime > 0 && Math.abs(v.duration - v.currentTime) < 2);
        });
        
        if (isEnded) {
          console.log('✅ Video playback has finished naturally. Stopping recording early.');
          wasSplit = false; // Finished naturally, no next part needed
          break;
        }
      } catch (err) {
        // Ignore evaluation errors
      }
    }

    await stopRecorder(ffmpeg);
    ffmpeg = null;

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
      throw new Error('Recording file was not created or is empty.');
    }

    console.log(`✅ Recording saved: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
    return { outputPath, wasSplit, durationRecordedMs: recordMs };
  } finally {
    if (ffmpeg) await stopRecorder(ffmpeg).catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { recordClass };




