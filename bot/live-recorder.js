const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const MAX_MS = parseInt(process.env.MAX_RECORDING_MS || 18000000, 10);

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function startRecorder(outputPath, durationSeconds, cropFilter = 'crop=1204:604:76:200') {
  const display = process.env.DISPLAY || ':99';
  const pulseSource = process.env.PULSE_CAPTURE_SOURCE || 'teams_sink.monitor';

  const args = [
    '-y',
    '-thread_queue_size', '4096',
    '-f', 'x11grab',
    '-draw_mouse', '0',
    '-video_size', process.env.RECORDING_SIZE || '1280x805',
    '-framerate', process.env.RECORDING_FPS || '30',
    '-i', display,
    '-thread_queue_size', '4096',
    '-f', 'pulse',
    '-i', pulseSource,
    '-t', String(durationSeconds),
    '-c:v', 'libx264',
    '-preset', process.env.FFMPEG_PRESET || 'veryfast',
    '-crf', process.env.FFMPEG_CRF || '23',
    '-vf', cropFilter,
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-b:a', process.env.FFMPEG_AUDIO_BITRATE || '128k', '-ar', '44100', '-ac', '2',
    '-movflags', 'frag_keyframe+empty_moov',
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
    if (!proc) return resolve();
    let resolved = false;
    const finish = () => { if (!resolved) { resolved = true; resolve(); } };
    proc.on('close', finish);
    proc.on('exit', finish);
    try { proc.kill('SIGINT'); } catch(e){}
    setTimeout(() => {
      try { process.kill(proc.pid, 'SIGKILL'); } catch(e){}
      finish();
    }, 5000);
  });
}

async function recordLiveClass(url, outputPath, cookies, options = {}) {
  const maxMs = options.maxMs || MAX_MS;
  let isNativeFullScreen = false;
  let browser;
  let ffmpeg;

  try {
    if (options.onStatus) await options.onStatus('STARTING_BROWSER');
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
      permissions: ['microphone', 'camera'],
      colorScheme: 'dark'  // Force dark mode in Teams
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
                // The mic toggle is an <input type="checkbox" role="switch" data-tid="toggle-mute">
                // data-cid="toggle-mute-true" means mic is ON (unmuted)
                // data-cid="toggle-mute-false" means mic is OFF (muted)
                const micInput = document.querySelector('input[data-tid="toggle-mute"]');
                if (micInput) {
                    const dataCid = micInput.getAttribute('data-cid') || '';
                    const isChecked = micInput.checked;
                    console.log('[DEBUG-DUMP] Mic input data-cid:', dataCid, 'checked:', isChecked);
                    // toggle-mute-true = mic is ON (need to mute)
                    // checked = true also means mic is ON on the prejoin screen
                    return dataCid === 'toggle-mute-true' || isChecked === true;
                }
                // Fallback: check aria-label buttons
                const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('mic')
                );
                micBtns.forEach(b => console.log('[DEBUG-DUMP] Prejoin Mic fallback:', b.outerHTML));
                return false;
            });
            if (isMicOn) {
                console.log('[DEBUG] Mic is ON on prejoin, clicking to mute...');
                await page.evaluate(() => {
                    // Click the checkbox input directly
                    const micInput = document.querySelector('input[data-tid="toggle-mute"]');
                    if (micInput) {
                        micInput.click();
                    } else {
                        const btn = document.querySelector('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]');
                        if (btn) btn.click();
                    }
                });
                await page.waitForTimeout(1000);
            } else {
                console.log('[DEBUG] Mic already muted on prejoin.');
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

    // Wait for Lobby to clear BEFORE setting up UI and Recording
    console.log('[DEBUG] Waiting to be admitted from lobby...');
    if (options.onStatus) await options.onStatus('WAITING_IN_LOBBY');
    let initLobbyWaitLoops = 0;
    let admitted = false;
    while (!admitted && initLobbyWaitLoops < 120) { 
        // Wait in lobby (up to 30 mins)
        const isAdmitted = await page.evaluate(() => {
            const text = document.body.innerText || '';
            console.log('[DEBUG-DUMP] Lobby screen text:', text.replace(/\n/g, ' | '));
            
            const lowerText = text.toLowerCase();
            
            // DEFINITE lobby indicators
            const hardLobby = lowerText.includes('someone will let you in') || 
                              lowerText.includes('we\'ve let people in the meeting know you\'re waiting') ||
                              lowerText.includes('when the meeting starts, we\'ll let people know') ||
                              lowerText.includes('hi, raj. someone will let you in');
            if (hardLobby) return false;
            
            // If we can see a running timer (format mm:ss like 00:26, 01:41) AND a Leave button, we are IN
            const hasTimer = /(?:\d{2}:\d{2}|--:--)/.test(text);
            const hasLeaveBtn = !!document.querySelector('[data-tid="hang-up-btn"], [data-tid="leave-button"], [data-tid="call-hangup"]') ||
                                lowerText.includes('leave');
            if (hasTimer && hasLeaveBtn) return true;
            
            // Also check for video gallery
            const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
            if (hasVideoGallery) return true;
            
            // Check for instant drop/kick
            if (lowerText.includes('rejoin') || lowerText.includes('returning to teams meetings') || lowerText.includes('did you leave by mistake')) {
                return 'dropped';
            }
            
            return false;
        });
        
        if (isAdmitted === true) {
            admitted = true;
            break;
        } else if (isAdmitted === 'dropped') {
            console.log('[DEBUG] Call dropped immediately upon joining (Rejoin screen detected). Exiting early.');
            break; // will fall through to !admitted check and exit
        }
        await page.waitForTimeout(15000);
        initLobbyWaitLoops++;
    }

    if (!admitted) {
        console.log('[DEBUG] Lobby timeout reached (10 minutes) before recording started. Exiting.');
        await browser.close();
        return;
    }
    console.log('[DEBUG] Admitted to meeting. Setting up UI (Mic, Hide me, Full screen).');
    if (options.onStatus) await options.onStatus('ADMITTED_PREPARING_UI');

    // (Removed CSS blur so participants can be seen)

    await page.waitForTimeout(5000); // Give the meeting UI 5 seconds to fully render

    
    // Double check mic is muted inside the meeting
    try {
        console.log('[DEBUG] Checking mic status inside meeting...');
        const isMicUnmuted = await page.evaluate(() => {
            // Check the input toggle (same as prejoin)
            const micInput = document.querySelector('input[data-tid="toggle-mute"]');
            if (micInput) {
                const dataCid = micInput.getAttribute('data-cid') || '';
                console.log('[DEBUG-DUMP] In-meeting Mic Input data-cid:', dataCid, 'checked:', micInput.checked);
                return dataCid === 'toggle-mute-true' || micInput.checked === true;
            }
            // Fallback: dump all mic-related elements
            const btns = document.querySelectorAll('[data-tid="toggle-mute"], button[aria-label*="Mute" i], button[aria-label*="mic" i]');
            btns.forEach(btn => console.log('[DEBUG-DUMP] In-meeting Mic Btn:', btn.getAttribute('aria-label'), btn.getAttribute('aria-checked'), btn.getAttribute('data-cid')));
            for (const btn of btns) {
                const label = (btn.getAttribute('aria-label') || '').toLowerCase().trim();
                const dataCid = btn.getAttribute('data-cid') || '';
                if (label === 'mute' || label === 'mute microphone' || dataCid.endsWith('-true')) return true;
            }
            return false;
        });
        console.log('[DEBUG] Mic unmuted status:', isMicUnmuted);
        if (isMicUnmuted) {
            console.log('[DEBUG] Mic is ON inside meeting, muting via keyboard shortcut Ctrl+Shift+M...');
            await page.keyboard.press('Control+Shift+M');
            await page.waitForTimeout(2000);
        } else {
            console.log('[DEBUG] Mic is already muted inside meeting.');
        }
    } catch(e) { console.log('[DEBUG] Mic verify error:', e.message); }

    // ROOT CAUSE FIXED: Teams Web renders the active meeting inside a floating call widget on top-left of main pane (~x:350, y:120).
    // Clicking the floating card header or active call indicator expands it to full screen.
    try {
        console.log('[DEBUG] Attempting to expand floating call widget to full view...');

        // Screenshot pre-expand
        try {
            const screenshotB64 = await page.screenshot({ encoding: 'base64' });
            if (options.onFrame) await options.onFrame(screenshotB64);
            console.log('[DEBUG] Pre-expand screenshot pushed.');
        } catch(se) {}

        // Check if already in full meeting view (video or full stage)
        let isFullView = await page.evaluate(() => {
            const v = document.querySelector('video');
            if (v && v.getBoundingClientRect().width > 500) return true;
            const stage = document.querySelector('[data-tid="calling-roster-stage"], [data-tid="video-gallery"]');
            return stage && stage.getBoundingClientRect().width > 500;
        });
        console.log('[DEBUG] Initial full view status:', isFullView);

        if (!isFullView) {
            console.log('[DEBUG] Meeting is in compact floating card mode. Dynamically scanning entire viewport for card bounds...');

            // Step 1: Detect floating card container bounds dynamically across the entire viewport
            const cardInfo = await page.evaluate(() => {
                const results = [];
                const all = Array.from(document.querySelectorAll('div, section, main, [role="region"], [role="dialog"]'));
                for (const el of all) {
                    const r = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    const isFloating = style.position === 'fixed' || style.position === 'absolute' || parseInt(style.zIndex, 10) > 20;
                    // Floating card dimensions: width 150-600px, height 100-500px
                    if (isFloating && r.width >= 150 && r.width <= 600 && r.height >= 100 && r.height <= 500 && r.x >= 0 && r.y >= 0) {
                        results.push({
                            x: Math.round(r.x),
                            y: Math.round(r.y),
                            w: Math.round(r.width),
                            h: Math.round(r.height),
                            tag: el.tagName,
                            text: el.textContent?.trim().slice(0, 30)
                        });
                    }
                }
                return results;
            });
            console.log('[DEBUG-CARD-INFO] Detected floating cards:', JSON.stringify(cardInfo));

            // Step 2: Extract expand buttons anywhere in DOM (matching expand / popout / full / maximize)
            const expandBtnCoords = await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, [role="button"], a, svg'));
                const list = [];
                for (const b of btns) {
                    const r = b.getBoundingClientRect();
                    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.getAttribute('data-tid') || b.textContent || '').toLowerCase();
                    if (r.width > 5 && r.height > 5 && (label.includes('expand') || label.includes('full') || label.includes('popout') || label.includes('maximize') || label.includes('return') || label.includes('pip'))) {
                        list.push({
                            cx: Math.round(r.x + r.width / 2),
                            cy: Math.round(r.y + r.height / 2),
                            label: label.slice(0, 30)
                        });
                    }
                }
                return list;
            });
            console.log('[DEBUG-EXPAND-BTNS] Found expand button elements:', JSON.stringify(expandBtnCoords));

            // Step 3: Physically click detected expand buttons
            for (const item of expandBtnCoords) {
                console.log(`[DEBUG] Physical mouse click on expand button "${item.label}" at (${item.cx}, ${item.cy})...`);
                await page.mouse.click(item.cx, item.cy);
                await page.waitForTimeout(1000);
            }

            // Step 4: Physically click top-right corner of all detected floating cards
            for (const card of cardInfo) {
                const topRightX = card.x + card.w - 15;
                const topRightY = card.y + 15;
                const headerCenterX = card.x + Math.round(card.w / 2);
                const headerCenterY = card.y + 15;

                console.log(`[DEBUG] Physical mouse click on card top-right expand icon (${topRightX}, ${topRightY})...`);
                await page.mouse.click(topRightX, topRightY);
                await page.waitForTimeout(1000);

                console.log(`[DEBUG] Physical mouse click on card header center (${headerCenterX}, ${headerCenterY})...`);
                await page.mouse.click(headerCenterX, headerCenterY);
                await page.waitForTimeout(800);

                console.log(`[DEBUG] Double-clicking card header (${headerCenterX}, ${headerCenterY})...`);
                await page.mouse.dblclick(headerCenterX, headerCenterY);
                await page.waitForTimeout(1000);
            }

            // Step 5: Fallback hardcoded physical clicks at exact coordinates from user screenshot (media_1791363100726.png)
            // Screenshot shows card at x: 234-384, y: 368-615 -> Expand icon ↖↗ at (373, 388), Header at (310, 388)
            const fallbackPoints = [
                { x: 373, y: 388, desc: 'Exact Expand Icon ↖↗ from Screenshot' },
                { x: 365, y: 388, desc: 'Top-Right Icon Area' },
                { x: 310, y: 388, desc: 'Card Header Bar' },
                { x: 380, y: 95, desc: 'Top position Expand Icon' }
            ];
            for (const pt of fallbackPoints) {
                console.log(`[DEBUG] Fallback click on ${pt.desc} (${pt.x}, ${pt.y})...`);
                await page.mouse.click(pt.x, pt.y);
                await page.waitForTimeout(800);
            }

            // Step 6: Click "Calls" tab on left app bar (34, 320)
            console.log('[DEBUG] Clicking Calls tab on left app bar (34, 320)...');
            await page.mouse.click(34, 320);
            await page.waitForTimeout(1500);

            // Check expansion status
            isFullView = await page.evaluate(() => {
                const v = document.querySelector('video');
                return (v && v.getBoundingClientRect().width > 500) || !!document.querySelector('[data-tid="calling-roster-stage"]');
            });
            console.log('[DEBUG] Post-expand full view status:', isFullView ? '✅ FULL VIEW ACTIVE!' : '⚠️ COMPACT WIDGET STILL ACTIVE');
        }

        // Post-expand screenshot
        try {
            const screenshotB64_2 = await page.screenshot({ encoding: 'base64' });
            if (options.onFrame) await options.onFrame(screenshotB64_2);
            console.log('[DEBUG] Post-expand screenshot pushed.');
        } catch(se) {}

        // Close any overlay
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts')) {
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) { console.log('[DEBUG] Meeting expand error:', e.message); }




    // Try to activate "Hide me" and "Full screen" using aggressive locators
    try {

    console.log('[DEBUG] Searching for View button safely inside meeting toolbar...');
        // ONLY look for View inside the actual meeting toolbar to avoid clicking "View Apps" in Teams sidebar!
        const viewBtn = page.locator('[data-tid="meeting-toolbar"] button, [data-tid="calling-status-bar"] button, [id="roster-button"]~button, button[aria-label="View"]').filter({ hasText: /^View$/i }).first();
        const viewBtnFallback = page.locator('[data-tid="meeting-toolbar"] button[aria-label*="View"], [data-tid="meeting-toolbar"] button[data-tid*="view"]').first();
        const targetViewBtn = (await viewBtn.isVisible({ timeout: 2000 })) ? viewBtn : viewBtnFallback;
        
        if (await targetViewBtn.isVisible({ timeout: 2000 })) {
            await targetViewBtn.click();
            console.log('[DEBUG] Clicked View button.');
            await page.waitForTimeout(1500);
            
            // Full Screen option
            const fullScreenBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /Full screen/i }).first();
            if (await fullScreenBtn.isVisible({ timeout: 1000 })) {
                await fullScreenBtn.click();
                console.log('[DEBUG] Clicked Full screen.');
                isNativeFullScreen = true;
                await page.waitForTimeout(1500);
                // Click View again because menu closes
                await targetViewBtn.click();
                await page.waitForTimeout(1500);
            }
            
            // Check for Hide me directly
            const hideMeBtn = page.locator('menuitem, button, div[role="menuitem"], span').filter({ hasText: /Hide me/i }).first();
            let hideMeClicked = false;
            
            if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                await hideMeBtn.click();
                console.log('[DEBUG] Clicked Hide me directly.');
                hideMeClicked = true;
            } else {
                // Try More options option
                const moreOptionsBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /More options/i }).first();
                if (await moreOptionsBtn.isVisible({ timeout: 1000 })) {
                    await moreOptionsBtn.click();
                    console.log('[DEBUG] Clicked More options.');
                    await page.waitForTimeout(1500);
                    
                    if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                        await hideMeBtn.click();
                        console.log('[DEBUG] Clicked Hide me after More options.');
                        hideMeClicked = true;
                    }
                }
            }
            
            if (!hideMeClicked) console.log('[DEBUG] Hide me button not found in menu.');
            
            await page.mouse.click(0, 500); // close menu
        } else {
            console.log('[DEBUG] View button not found entirely.');
        }
    } catch (e) {
        console.log('[DEBUG] Could not click Hide me/Full screen:', e.message);
    }

    // NOTE: We do NOT open the People panel manually.
    // The participants list shows naturally on the right side when the meeting is in full view.
    // Clicking People button from mini-PiP state opens "All contacts" sidebar instead.

    // Hide UI
    try {
      await page.keyboard.press('F11');
      
      const injectHider = async (frame) => {
        try {
          await frame.evaluate(() => {
            const style = document.createElement('style');
            style.innerHTML = `
    * { cursor: none !important; }
    div[role="alert"], 
    div[role="banner"],
    div[data-tid^="toast"], 
    div[data-tid^="banner"], 
    .ui-toast, 
    .toast-container, 
    .ts-toast-stack,
    [role="tooltip"],
    .fui-Tooltip,
    .ui-tooltip,
    div[aria-label*="notification" i],
    div[aria-live="polite"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
    }
`;
            document.head.appendChild(style);

            setInterval(() => {
                try {
                    // Remove all title attributes to stop hover tooltips
                    document.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));

                    // Aggressively dismiss toasts/popups
                    const btns = document.querySelectorAll('button');
                    btns.forEach(btn => {
                        const t = (btn.textContent || '').trim().toLowerCase();
                        if (t === 'dismiss' || t === 'got it' || t === 'not now') {
                            btn.click();
                        }
                    });
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

                    // (Participants pane hiding removed)

                    // (Force video stage removed so roster can share screen space)
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
    await page.mouse.move(0, 800, { steps: 10 });

    // Strict Timer Check
    if (options.scheduledTime && Date.now() < options.scheduledTime) {
        const waitMs = options.scheduledTime - Date.now();
        if (options.onStatus) await options.onStatus('WAITING_FOR_SCHEDULED_TIME');
        console.log(`[DEBUG] Joined early. Waiting ${Math.floor(waitMs/1000)}s until scheduled time to start recording...`);
        await page.waitForTimeout(waitMs);
    }

    // Start FFmpeg
    if (options.onStatus) await options.onStatus('RECORDING');
    console.log('🎥 Starting FFmpeg recording for live class...');
    const recordMs = maxMs;
    const cropF = isNativeFullScreen ? 'crop=1280:720:0:85,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2' : 'crop=1204:604:76:200,scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2';
      ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000), cropF);

    const startTime = Date.now();
    let loopCount = 0;
      let lobbyWaitLoops = 0;
    let maxParticipants = 0;
          const recentCounts = [];
    
    while (Date.now() - startTime < recordMs) {
      await sleep(15000); // Check every 15 seconds
      try {
        if (options.onFrame) {
            const buf = await page.screenshot({ type: 'jpeg', quality: 30 });
            await options.onFrame('data:image/jpeg;base64,' + buf.toString('base64'));
        }
      } catch (err) {}
      loopCount++;

      // Anti-idle
      if (loopCount % 20 === 0) {
        try {
          await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 500);
          await sleep(500);
          await page.mouse.move(0, 800, { steps: 10 });
        } catch (e) {}
      }
      
      // End meeting detection
      try {
        const stats = await page.evaluate(() => {
            const text = document.body.textContent || "";
            let ended = false;
            let currentCount = 0;
              if (text.includes("The meeting has ended") || text.includes("was ended by organizer") || text.includes("You've left the meeting") || text.includes("removed you from the meeting") || text.includes("You were removed from the meeting") || text.includes("You're disconnected")) {
                  ended = true;
              }

            // Check if bot is completely alone (only if explicit count of 1 is present, NOT 'Waiting for others to join')
            if (text.includes("In this meeting (1)") || text.includes("Attendees (1)") || text.includes("Participants (1)")) {
                // Do not mark ended immediately when alone; record normally unless meeting explicitly ended
                currentCount = 1;
            }
            
            // Extract participant count
            const match = text.match(/(?:In this meeting|Attendees|Participants) \((\d+)\)/);
            if (match) {
                currentCount = parseInt(match[1], 10);
            }
            
            const inLobby = text.includes("We've let people in the meeting know you're waiting") || text.includes("When the meeting starts, we'll let people know you're waiting");
            
            // Check if meeting UI is completely missing (meaning we were kicked to the main screen)
            const hasMeetingUI = !!document.querySelector('[data-tid="meeting-toolbar"], [data-tid="calling-status-bar"], [data-tid="calls-pip"], .app-svg, video');
            
            return { ended, currentCount, text, inLobby, hasMeetingUI };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        // If we were admitted, but now the meeting UI is completely gone for 3 loops (45 seconds), it means the meeting ended.
        if (!stats.inLobby && !stats.hasMeetingUI && loopCount > 10) {
            console.log('[DEBUG] No meeting UI detected (no toolbar, no pip, no video). Meeting likely ended or disconnected.');
            meetingEnded = true;
        }
        
        // Lobby Timeout Logic (10 minutes)
        if (stats.inLobby) {
            lobbyWaitLoops++;
            if (lobbyWaitLoops > 120) {
                console.log(`[DEBUG] Lobby timeout reached (30 minutes without being admitted). Ending meeting.`);
                meetingEnded = true;
            }
        } else {
            lobbyWaitLoops = 0; // Reset if admitted
        }
        
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
                if (currentCount > 0 && currentCount <= Math.ceil(recentMax * 0.60)) {
                    console.log(`[DEBUG] Sudden mass exodus detected! Recent max was ${recentMax}, now ${currentCount}. Ending meeting.`);
                    meetingEnded = true;
                }
            } else if (recentMax > 1 && recentMax <= 5) {
                if (currentCount > 0 && currentCount <= 2 && currentCount < recentMax) {
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
    if (browser) {
      const bTimeout = setTimeout(() => { try { browser.process().kill('SIGKILL'); } catch(e){} }, 8000);
      await browser.close().catch(()=>{});
      clearTimeout(bTimeout);
    }
  }
}

module.exports = recordLiveClass;
