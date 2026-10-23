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

async function performInlineLogin(page, creds) {
  if (!creds || !creds.email || !creds.password) {
    console.log('[DEBUG] No credentials available to perform inline login.');
    return false;
  }
  console.log('[DEBUG] Performing inline login for:', creds.email);
  try {
    // 1. Dhoondho sign-in button ko main page aur all iframes me
    let clickedSignIn = false;
    const signInSelectors = [
      'button[data-tid="prejoin-signin-button"]',
      'button[data-tid*="signin"]',
      'button[data-tid*="sign-in"]',
      'a[data-tid*="signin"]',
      'button:has-text("Sign in")',
      'a:has-text("Sign in")',
      'button:has-text("Sign in to join")',
      'span:has-text("Sign in")'
    ];

    for (const frame of [page, ...page.frames()]) {
      for (const sel of signInSelectors) {
        try {
          const btn = frame.locator(sel).first();
          if (await btn.isVisible({ timeout: 1000 })) {
            console.log(`[DEBUG] Found Sign in button with selector '${sel}' in frame ${frame.url()}. Clicking...`);
            await btn.click({ force: true });
            clickedSignIn = true;
            break;
          }
        } catch(e){}
      }
      if (clickedSignIn) break;
    }

    await page.waitForTimeout(4000);

    // 2. Identify target page (agar popup window khula ho)
    let targetPage = page;
    const context = page.context();
    for (const p of context.pages()) {
      const u = p.url().toLowerCase();
      if (p !== page && (u.includes('login.') || u.includes('microsoft') || u.includes('live.com'))) {
        targetPage = p;
        console.log('[DEBUG] Switch to login popup window:', targetPage.url());
        break;
      }
    }

    // Helper to find input in targetPage or its frames
    async function findInputInPageOrFrames(p, selectors) {
      for (const frame of [p, ...p.frames()]) {
        for (const sel of selectors) {
          try {
            const loc = frame.locator(sel).first();
            const count = await loc.count();
            if (count > 0) {
              const visible = await loc.isVisible().catch(() => false);
              return { frame, loc, sel, visible };
            }
          } catch(e){}
        }
      }
      return null;
    }

    // 3. Email Input
    const emailSelectors = [
      'input[type="email"]',
      'input[name="loginfmt"]',
      'input[name="login"]',
      '#i0116',
      'input[placeholder*="email" i]',
      'input[placeholder*="phone" i]'
    ];

    let emailFound = null;
    for (let attempt = 0; attempt < 12; attempt++) {
      for (const p of context.pages()) {
        const u = p.url().toLowerCase();
        if (p !== page && (u.includes('login.') || u.includes('microsoft') || u.includes('live.com'))) {
          targetPage = p;
          break;
        }
      }
      emailFound = await findInputInPageOrFrames(targetPage, emailSelectors);
      if (!emailFound && targetPage !== page) {
        emailFound = await findInputInPageOrFrames(page, emailSelectors);
        if (emailFound) targetPage = page;
      }
      if (emailFound) break;
      await page.waitForTimeout(1000);
    }

    if (emailFound) {
      console.log(`[DEBUG] Found email input (${emailFound.sel}). Entering email...`);
      await emailFound.loc.focus();
      await emailFound.loc.fill(creds.email);
      await targetPage.waitForTimeout(500);
      await targetPage.keyboard.press('Enter');
      await targetPage.waitForTimeout(2000);
      try {
        await targetPage.click('#idSIButton9, input[type="submit"], button:has-text("Next")', { timeout: 2000, force: true });
      } catch(e){}
    } else {
      console.log('[DEBUG] ⚠️ Email input not found during inline login.');
      return false;
    }

    // 4. Check for password switch/bypass (across targetPage and all its frames)
    console.log('[DEBUG] Waiting for password screen or bypass button...');
    const bypassSelectors = [
      '#idA_PWD_SwitchToPassword',
      '#idA_PWD_SwitchToCredPicker',
      '[role="button"]:has-text("Use your password")',
      'span:has-text("Use your password")',
      'button:has-text("Use your password")',
      'a:has-text("Use your password")',
      'div:has-text("Use your password")'
    ];

    // Wait up to 10s for bypass button
    for (let attempt = 0; attempt < 10; attempt++) {
      let bypassClicked = false;
      for (const p of [targetPage, page, ...page.context().pages()]) {
        for (const frame of [p, ...p.frames()]) {
          for (const sel of bypassSelectors) {
            try {
              const bypass = frame.locator(sel).first();
              if (await bypass.isVisible({ timeout: 500 })) {
                console.log(`[DEBUG] Found bypass button (${sel}) in frame. Clicking...`);
                await bypass.click({ force: true });
                await frame.evaluate((s) => {
                  const el = document.querySelector(s) || Array.from(document.querySelectorAll('a, button, span')).find(e => (e.innerText||'').includes('Use your password'));
                  if (el) el.click();
                }, sel).catch(() => {});
                bypassClicked = true;
                targetPage = p;
                break;
              }
            } catch(e){}
          }
          if (bypassClicked) break;
        }
        if (bypassClicked) break;
      }
      if (bypassClicked) {
        await targetPage.waitForTimeout(2500);
        break;
      }
      await targetPage.waitForTimeout(1000);
    }

    // 5. Password Input (Poll across all pages and frames for up to 15 seconds)
    const pwdSelectors = [
      '#passwordEntry',
      'input[type="password"]',
      'input[name="passwd"]',
      '#i0118',
      'input[placeholder*="password" i]'
    ];

    let pwdResult = null;
    for (let attempt = 0; attempt < 15; attempt++) {
      for (const p of [targetPage, page, ...page.context().pages()]) {
        pwdResult = await findInputInPageOrFrames(p, pwdSelectors);
        if (pwdResult) {
          targetPage = p;
          break;
        }
      }
      if (pwdResult) break;
      await targetPage.waitForTimeout(1000);
    }

    if (pwdResult) {
      console.log(`[DEBUG] Found password input (${pwdResult.sel}) in frame. Entering password...`);
      const targetFrame = pwdResult.frame || targetPage;
      await pwdResult.loc.scrollIntoViewIfNeeded().catch(() => {});
      await pwdResult.loc.focus();
      await pwdResult.loc.fill(creds.password);
      await targetPage.waitForTimeout(500);
      await pwdResult.loc.press('Enter');
      await targetPage.waitForTimeout(2000);
      try {
        const submitBtn = targetFrame.locator('#idSIButton9, input[type="submit"], button:has-text("Sign in"), button:has-text("Next")').first();
        if (await submitBtn.isVisible({ timeout: 2000 })) {
          await submitBtn.click({ force: true });
        }
      } catch(e){}
    } else {
      console.log('[DEBUG] ⚠️ Password input not found during inline login.');
      return false;
    }

    // 6. 'Stay signed in?' prompt
    try {
      await targetPage.waitForTimeout(2000);
      const stayBtn = targetPage.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes")').first();
      if (await stayBtn.isVisible({ timeout: 4000 })) {
        console.log('[DEBUG] Clicking "Yes" on Stay signed in prompt...');
        await stayBtn.click({ force: true });
        await targetPage.waitForTimeout(3000);
      }
    } catch(e){}

    // 7. Save fresh cookies & storageState to Firebase so next time it is already authenticated!
    try {
      const context = page.context();
      const freshCookies = await context.cookies();
      const freshStorageState = await context.storageState();
      const admin = require('firebase-admin');
      if (admin.apps.length) {
        const targetAccount = (creds && creds.name) ? creds.name : 'teams_creds';
        await admin.database().ref(`config/${targetAccount}`).update({
          cookies: freshCookies,
          storageState: JSON.stringify(freshStorageState),
          updatedAt: Date.now()
        });
        console.log(`[DEBUG] ✅ Saved fresh session to Firebase for ${targetAccount} (${freshCookies.length} cookies)`);
      }
    } catch(err) {
      console.log('[DEBUG] Note on saving fresh session to Firebase:', err.message);
    }

    console.log('[DEBUG] Inline login complete.');
    return true;
  } catch(e) {
    console.log('[DEBUG] Inline login error:', e.message);
    return false;
  }
}

// ---------- HELPERS ----------
async function isMeetingFullView(page) {
  try {
    return await page.evaluate(() => {
      const stage = document.querySelector(
        '[data-tid="calling-roster-stage"], [data-tid="video-gallery"], [data-tid="meeting-canvas"]'
      );
      if (stage && stage.getBoundingClientRect().width > 600) return true;
      const tb = document.querySelector('[data-tid="meeting-toolbar"]');
      return !!(tb && tb.getBoundingClientRect().width > 600);
    });
  } catch (e) {
    return false;
  }
}

// Mini call popup = chhota fixed/absolute box jisme timer (mm:ss) + 3+ buttons hon.
// Sabse chhota match return karte hain taaki galat bada container na pakde.
async function findPipRect(page) {
  try {
    return await page.evaluate(() => {
      const matches = [];
      for (const el of document.querySelectorAll('div, section')) {
        const r = el.getBoundingClientRect();
        if (r.width < 150 || r.width > 450 || r.height < 80 || r.height > 300) continue;
        const pos = getComputedStyle(el).position;
        if (pos !== 'fixed' && pos !== 'absolute') continue;
        if (!/\b\d{1,2}:\d{2}\b/.test(el.innerText || '')) continue;
        if (el.querySelectorAll('button').length < 3) continue;
        matches.push({ x: r.x, y: r.y, w: r.width, h: r.height, html: el.outerHTML.slice(0, 1500) });
      }
      return matches[0] || null;
    });
  } catch (e) {
    return null;
  }
}

// Migration banner ("Same app, better security") ko safely hide karta hai without clicking "Learn more" links.
async function dismissMigrationBanner(page) {
  try {
    return await page.evaluate(() => {
      let best = null;
      for (const el of document.querySelectorAll('div, section, header')) {
        const t = (el.innerText || '').toLowerCase();
        if (!t.includes('better security') && !t.includes('teams.cloud.microsoft')) continue;
        const r = el.getBoundingClientRect();
        if (r.height < 10 || r.height > 120 || r.width < 300) continue;
        if (!best || r.height * r.width < best.h * best.w) best = { el, h: r.height, w: r.width };
      }
      if (!best) return 0;
      
      // ONLY click explicit close (X) button (never "Learn more" link!)
      const closeBtn = Array.from(best.el.querySelectorAll('button, [role="button"], [aria-label]')).find(b => {
        const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.textContent || '')).toLowerCase();
        return (label.includes('close') || label.includes('dismiss')) && !label.includes('learn') && !label.includes('more');
      });
      if (closeBtn) {
        try { closeBtn.click(); } catch(e){}
      }

      // Hide the banner container safely in DOM
      best.el.style.setProperty('display', 'none', 'important');
      best.el.style.setProperty('opacity', '0', 'important');
      best.el.style.setProperty('visibility', 'hidden', 'important');
      best.el.style.setProperty('height', '0px', 'important');
      best.el.style.setProperty('margin', '0px', 'important');
      best.el.style.setProperty('padding', '0px', 'important');
      return 0;
    });
  } catch(e) {
    return 0;
  }
}

// Dismisses Teams toast notifications ("Your mic has been enabled", "Recording has started", etc.) safely without hiding the presentation stage
async function dismissRecordingNotifications(page) {
  try {
    await page.evaluate(() => {
      const isToastText = (txt) => {
        if (!txt) return false;
        const t = txt.toLowerCase();
        return (
          t.includes('recording has started') ||
          t.includes('recording started') ||
          t.includes('agree to be included') ||
          t.includes('transcription has started') ||
          t.includes('mic has been enabled') ||
          t.includes('mic has been disabled') ||
          t.includes('unmute if you') ||
          t.includes('camera has been enabled') ||
          t.includes('camera has been disabled') ||
          t.includes("you're muted") ||
          t.includes("you are muted") ||
          t.includes("your mic is muted") ||
          t.includes("allowed to unmute") ||
          t.includes("waiting in the lobby") ||
          t.includes("is waiting in the lobby") ||
          t.includes("in the lobby") ||
          t.includes("view lobby") ||
          t.includes("admit")
        );
      };

      const findCloseButton = (container) => {
        let b = container.querySelector('[aria-label*="Close" i], [aria-label*="Dismiss" i], [data-tid*="dismiss"], [data-tid*="close"]');
        if (!b) {
          const btns = Array.from(container.querySelectorAll('button, [role="button"], svg'));
          b = btns.find(btn => {
            const txt = (btn.textContent || '').trim().toLowerCase();
            const lbl = ((btn.getAttribute('aria-label') || '') + ' ' + (btn.getAttribute('title') || '')).toLowerCase();
            return txt === '✕' || txt === 'x' || txt === 'dismiss' || lbl.includes('close') || lbl.includes('dismiss');
          }) || container.querySelector('svg') || btns[0];
        }
        return b;
      };

      // 1. Text-based detection: Find any small container matching toast text
      const candidateElements = Array.from(document.querySelectorAll('div, section, aside, header, [role="dialog"], [role="alert"], [role="status"], [role="banner"]'));
      for (const el of candidateElements) {
        // Absolute safety: NEVER touch wrappers containing video, canvas, or screenshare/stage
        if (el.querySelector('video, canvas, [data-tid="video-gallery"], [data-tid="meeting-canvas"], [data-tid="calling-roster-stage"], [data-tid="presentation-stage"], [data-tid*="screen-share"], [data-tid*="sharing"]')) {
          continue;
        }

        const rect = el.getBoundingClientRect();
        // Toasts and alerts are small cards (width <= 650, height <= 320)
        if (rect.width > 0 && rect.width <= 650 && rect.height > 0 && rect.height <= 320) {
          const text = el.innerText || el.textContent || '';
          if (isToastText(text)) {
            // Find and click close (X) button inside the card specifically
            const closeBtn = findCloseButton(el);
            if (closeBtn) { try { closeBtn.click(); } catch(e){} }

            // Immediately nuke the container from visual layout
            el.style.setProperty('display', 'none', 'important');
            el.style.setProperty('visibility', 'hidden', 'important');
            el.style.setProperty('opacity', '0', 'important');
            el.style.setProperty('pointer-events', 'none', 'important');
            el.style.setProperty('position', 'absolute', 'important');
            el.style.setProperty('left', '-9999px', 'important');
            el.style.setProperty('height', '0px', 'important');
            el.style.setProperty('width', '0px', 'important');
          }
        }
      }

      // 2. Also search for any floating close button whose parent mentions recording / mic / camera / lobby
      const allButtons = Array.from(document.querySelectorAll('button, [role="button"]'));
      for (const b of allButtons) {
        const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.innerText || '')).toLowerCase();
        if (label.includes('close') || label.includes('dismiss') || label.includes('got it') || label === '✕' || label === 'x') {
          const parentText = (b.parentElement ? (b.parentElement.innerText || b.parentElement.textContent || '') : '').toLowerCase();
          if (
            parentText.includes('recording') || 
            parentText.includes('privacy policy') || 
            parentText.includes('transcription') || 
            parentText.includes('agree to be included') ||
            parentText.includes('mic') ||
            parentText.includes('unmute') ||
            parentText.includes('camera') ||
            parentText.includes('lobby')
          ) {
            try { b.click(); } catch(e){}
          }
        }
      }

      // 3. Inject continuous MutationObserver so newly appeared toast popups are nuked in real time immediately
      if (!window.__antiRecordingObserverInstalled) {
        window.__antiRecordingObserverInstalled = true;
        const observer = new MutationObserver(() => {
          const elements = Array.from(document.querySelectorAll('div, section, aside, header, [role="dialog"], [role="alert"], [role="status"], [role="banner"]'));
          for (const el of elements) {
            if (el.querySelector('video, canvas, [data-tid="video-gallery"], [data-tid="meeting-canvas"], [data-tid="presentation-stage"]')) continue;
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.width <= 650 && r.height > 0 && r.height <= 320) {
              const txt = el.innerText || el.textContent || '';
              if (isToastText(txt)) {
                const closeBtn = findCloseButton(el);
                if (closeBtn) { try { closeBtn.click(); } catch(e){} }
                el.style.setProperty('display', 'none', 'important');
                el.style.setProperty('visibility', 'hidden', 'important');
                el.style.setProperty('opacity', '0', 'important');
                el.style.setProperty('pointer-events', 'none', 'important');
                el.style.setProperty('position', 'absolute', 'important');
                el.style.setProperty('left', '-9999px', 'important');
                el.style.setProperty('height', '0px', 'important');
                el.style.setProperty('width', '0px', 'important');
              }
            }
          }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
  } catch(e) {}
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

    const contextOptions = {
      viewport: null,
      permissions: ['microphone', 'camera'],
      colorScheme: 'dark'  // Force dark mode in Teams
    };
    if (options.creds && options.creds.storageState) {
      try {
        contextOptions.storageState = typeof options.creds.storageState === 'string'
          ? JSON.parse(options.creds.storageState)
          : options.creds.storageState;
      } catch (err) {
        console.error('[DEBUG] Failed to parse storageState JSON:', err.message);
      }
    }
    const context = await browser.newContext(contextOptions);

    if (Array.isArray(cookies) && cookies.length) {
      const expandedCookies = [];
      for (const c of cookies) {
        expandedCookies.push(c);
        if (c.domain && (c.domain.includes('teams.microsoft.com') || c.domain.includes('office.com'))) {
          const cloudCookie = { ...c };
          if (c.domain.startsWith('.')) {
            cloudCookie.domain = '.teams.cloud.microsoft';
          } else {
            cloudCookie.domain = 'teams.cloud.microsoft';
          }
          expandedCookies.push(cloudCookie);
        }
      }
      try {
        await context.addCookies(expandedCookies);
      } catch(ce) {
        await context.addCookies(cookies);
      }
    }

    const page = await context.newPage();
    page.on('console', msg => console.log(`[Teams Live] ${msg.text()}`));

    // Auto-close external support tabs, and keep main recording page in front if RTT popup window opens
    context.on('page', async (popup) => {
      try {
        if (popup === page) return; // Never close main meeting page!
        await popup.waitForLoadState('domcontentloaded');
        const targetUrl = popup.url();
        if (targetUrl.includes('support.microsoft.com') || targetUrl.includes('learn.microsoft.com')) {
          console.log('[DEBUG] Auto-closing external support tab:', targetUrl);
          await popup.close().catch(() => {});
        } else {
          console.log('[DEBUG] Secondary popup window detected (e.g. popped out RTT). Keeping main recording page in front...');
          await page.bringToFront();
        }
      } catch(e) {}
    });

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

    // Helper: Turn off camera, mute microphone, and click "Join now"
    async function handlePrejoinMuteAndJoin(p) {
        // Ensure camera is OFF
        try {
            console.log('[DEBUG] Turning off Camera on prejoin...');
            await p.evaluate(() => {
                const camInput = document.querySelector('input[data-tid="toggle-video"]');
                if (camInput && camInput.checked) {
                    camInput.click();
                } else {
                    const camWrapper = document.querySelector('[data-tid="toggle-video"], button[aria-label*="camera" i], button[aria-label*="video" i]');
                    if (camWrapper && (camWrapper.getAttribute('aria-checked') === 'true' || camWrapper.checked)) {
                        camWrapper.click();
                    }
                }
            });
            await p.waitForTimeout(1000);
        } catch(e) {
            console.log('[DEBUG] Cam toggle error on prejoin', e.message);
        }

        // Ensure mic is MUTED
        try {
            console.log('[DEBUG] Turning off Mic on prejoin...');
            await p.evaluate(() => {
                const micInput = document.querySelector('input[data-tid="toggle-mute"]');
                if (micInput && micInput.checked) {
                    micInput.click();
                } else {
                    const micWrapper = document.querySelector('[data-tid="toggle-mute"], button[aria-label*="mic" i], button[aria-label*="mute" i]');
                    if (micWrapper && (micWrapper.getAttribute('aria-checked') === 'true' || micWrapper.checked)) {
                        micWrapper.click();
                    }
                }
            });
            await p.waitForTimeout(1000);
        } catch(e) {
            console.log('[DEBUG] Mic toggle error on prejoin', e.message);
        }

        console.log('[DEBUG] Clicking "Join now" with pointer event dispatch...');
        await p.evaluate(() => {
            const btn = document.getElementById('prejoin-join-button') || document.querySelector('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")');
            if (btn) {
                btn.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
                btn.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
                btn.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true }));
                btn.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
                btn.click();
            }
        });

        const joinBtn = p.locator('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")').first();
        try {
            if (await joinBtn.isVisible({ timeout: 4000 })) {
                await joinBtn.click({ timeout: 5000, force: true });
                await p.waitForTimeout(2000);
                if (await joinBtn.isVisible({ timeout: 1000 })) {
                    console.log('[DEBUG] Join button still visible, trying Enter key...');
                    await joinBtn.focus();
                    await p.keyboard.press('Enter');
                }
            }
        } catch(e) {}
    }

    // 2. Pre-join screen (Turn off Mic/Cam, Click Join Now, or click inline Chat Join banner)
    try {
        // Wait for pre-join screen OR inline chat Join button to load
        try {
            await page.waitForSelector('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now"), button:has-text("Join"), [data-tid*="join-button"]', { timeout: 25000 });
            console.log('[DEBUG] Pre-join screen or meeting button loaded.');
        } catch(e) {
            console.log('[DEBUG] Initial join button wait timed out. Checking current page elements...');
        }
        
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

        // CRITICAL FIX FOR SOL STUDENT ACCOUNTS:
        // If session cookies are expired, Teams shows a guest name input field.
        // SOL meetings REJECT guest join! We MUST perform inline login instead of joining as Guest.
        try {
            const nameInput = page.locator('input[data-tid="prejoin-display-name-input"]').first();
            if (await nameInput.isVisible({ timeout: 2000 })) {
                console.log('[DEBUG] ⚠️ Guest input detected! Session cookies expired. Triggering inline login with saved SOL creds...');
                let loggedIn = false;
                if (options.creds && options.creds.email && options.creds.password) {
                    loggedIn = await performInlineLogin(page, options.creds);
                    if (loggedIn) {
                        console.log('[DEBUG] Reloading meeting URL as authenticated SOL student...');
                        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
                        await page.waitForTimeout(5000);
                    }
                }
                
                // If inline login was attempted and left a login modal/iframe on screen, wait or close it
                if (!loggedIn) {
                    try {
                        const closeLoginBtn = page.locator('button[aria-label*="Close" i], button[title*="Close" i], [data-tid*="close"]').first();
                        if (await closeLoginBtn.isVisible({ timeout: 1000 })) {
                            await closeLoginBtn.click({ force: true });
                            await page.waitForTimeout(1000);
                        }
                    } catch(e){}
                }

                if (await nameInput.isVisible({ timeout: 2000 })) {
                    const baseName = (options.creds && (options.creds.name || options.creds.accountId)) ? (options.creds.name || options.creds.accountId) : 'Raj Singh';
                    const studentName = (options.creds && options.creds.email && !baseName.includes('@')) ? `${baseName} - ${options.creds.email}` : baseName;
                    console.log(`[DEBUG] Filling student name ("${studentName}")...`);
                    await nameInput.fill(studentName);
                    await page.waitForTimeout(1000);
                }
            }
        } catch (e) {}

        // Check if Teams loaded into the Chat channel view with an ongoing meeting banner ("Join" button)
        try {
            const chatJoinBtn = page.locator('button[data-tid*="chat-calling-join"], button[data-tid*="calling-join"], [data-tid*="channel-meeting-join-button"], button:has-text("Join"):not(:has-text("Join now"))').first();
            if (await chatJoinBtn.isVisible({ timeout: 2500 })) {
                console.log('[DEBUG] Found inline chat "Join" meeting banner! Clicking to launch call prejoin/stage...');
                await chatJoinBtn.click({ force: true });
                await page.waitForTimeout(3000);
            }
        } catch(e) {}

        // Handle prejoin mute and join now
        await handlePrejoinMuteAndJoin(page);
    } catch(e) {
        console.log('[DEBUG] Pre-join button error or already admitted:', e.message);
    }

    await page.waitForTimeout(5000);

    // Wait for Lobby to clear BEFORE setting up UI and Recording
    console.log('[DEBUG] Waiting to be admitted from lobby...');
    if (options.onStatus) await options.onStatus('WAITING_IN_LOBBY');
    try {
        const initialLobbyShot = await page.screenshot({ type: 'jpeg', quality: 40 });
        if (options.onFrame) await options.onFrame('data:image/jpeg;base64,' + initialLobbyShot.toString('base64'));
    } catch(se) {}
    let initLobbyWaitLoops = 0;
    let stuckPrejoinCount = 0;
    let admitted = false;
    while (!admitted && initLobbyWaitLoops < 120) { 
        let isAdmitted = false;
        try {
            isAdmitted = await page.evaluate(() => {
                const text = document.body.innerText || '';
                console.log('[DEBUG-DUMP] Lobby screen text:', text.replace(/\n/g, ' | '));
                
                const lowerText = text.toLowerCase();

                // Check if stuck on Microsoft login prompt ("Get a code to sign in", "Use your password")
                if (lowerText.includes('get a code to sign in') || lowerText.includes('use your password')) {
                    return 'stuck_login';
                }

                // Check if stuck on guest pre-join screen ("Type your name", "Enter a name to join")
                if (lowerText.includes('enter a name to join') || lowerText.includes('type your name')) {
                    return 'stuck_prejoin';
                }
                
                // DEFINITE lobby indicators
                const hardLobby = lowerText.includes('someone will let you in') || 
                                  lowerText.includes('we\'ve let people in the meeting know you\'re waiting') ||
                                  lowerText.includes('when the meeting starts, we\'ll let people know') ||
                                  lowerText.includes('let you in when the meeting starts') ||
                                  lowerText.includes('waiting in the lobby');
                if (hardLobby) return 'in_lobby';
                
                // If we can see a running timer (format mm:ss like 00:26, 01:41) AND a Leave button, we are IN
                const hasTimer = /(?:\d{2}:\d{2}|--:--)/.test(text);
                const hasLeaveBtn = !!document.querySelector('[data-tid="hang-up-btn"], [data-tid="leave-button"], [data-tid="call-hangup"]') ||
                                    lowerText.includes('leave');
                if (hasTimer && hasLeaveBtn) return true;
                
                // Also check for video gallery
                const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
                if (hasVideoGallery) return true;
                
                // Check for transient error screen ("We ran into a problem")
                if (lowerText.includes('we ran into a problem') || lowerText.includes('try again in a few minutes') || lowerText.includes('something went wrong')) {
                    return 'error_screen';
                }
                
                // Check for explicit denial
                if (lowerText.includes('denied access to the meeting') || lowerText.includes('you were denied') || lowerText.includes('removed from the meeting')) {
                    return 'denied';
                }

                // Check for instant drop/kick
                if (lowerText.includes('rejoin') || lowerText.includes('returning to teams meetings') || lowerText.includes('did you leave by mistake')) {
                    return 'dropped';
                }
                
                return false;
            });
        } catch (evalErr) {
            console.log('[DEBUG] Page evaluation during lobby wait caught error (navigation/transition in progress):', evalErr.message);
            // Wait 3 seconds for the navigation/redirect to settle
            await page.waitForTimeout(3000);
            continue;
        }
        
        if (isAdmitted === true) {
            admitted = true;
            break;
        } else if (isAdmitted === 'in_lobby') {
            console.log('[DEBUG] ⏳ Successfully in meeting lobby. Waiting for organizer to admit...');
        } else if (isAdmitted === 'denied') {
            console.log('[DEBUG] ❌ Organizer explicitly denied access to the meeting. Exiting lobby wait loop.');
            break;
        } else if (isAdmitted === 'stuck_login') {
            console.log('[DEBUG] ⚠️ Stuck on Microsoft login prompt during lobby wait. Handling password login...');
            try {
                // Click "Use your password"
                for (const frame of [page, ...page.frames()]) {
                    const bypass = frame.locator('button:has-text("Use your password"), a:has-text("Use your password"), #idA_PWD_SwitchToPassword').first();
                    if (await bypass.isVisible({ timeout: 1000 })) {
                        console.log('[DEBUG] Clicked "Use your password" prompt in lobby wait.');
                        await bypass.click({ force: true });
                        await page.waitForTimeout(2000);
                        break;
                    }
                }
                // Enter password if visible
                if (options.creds && options.creds.password) {
                    for (const frame of [page, ...page.frames()]) {
                        const pwd = frame.locator('input[type="password"], input[name="passwd"]').first();
                        if (await pwd.isVisible({ timeout: 1500 })) {
                            console.log('[DEBUG] Filling password in lobby wait prompt...');
                            await pwd.fill(options.creds.password);
                            await page.keyboard.press('Enter');
                            await page.waitForTimeout(3000);
                            break;
                        }
                    }
                }
            } catch(e) {
                console.log('[DEBUG] Error handling stuck_login prompt:', e.message);
            }
        } else if (isAdmitted === 'stuck_prejoin') {
            stuckPrejoinCount++;
            console.log(`[DEBUG] ⚠️ Stuck on pre-join guest screen (attempt ${stuckPrejoinCount}/4). Filling guest name & clicking Join now...`);
            try {
                const nameInput = page.locator('input[data-tid="prejoin-display-name-input"]').first();
                if (await nameInput.isVisible({ timeout: 2000 })) {
                    const studentName = (options.creds && options.creds.name) ? options.creds.name : 'Raj Thakur';
                    await nameInput.fill(studentName);
                    await page.waitForTimeout(1000);
                }
                const jBtn = page.locator('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")').first();
                if (await jBtn.isVisible({ timeout: 2000 })) {
                    await jBtn.click({ force: true });
                }
            } catch(e) {}

            if (stuckPrejoinCount >= 4) {
                console.log('[DEBUG] ⚠️ Meeting stuck on pre-join screen for 1 minute without joining. Exiting lobby wait loop.');
                break;
            }
        } else if (isAdmitted === 'error_screen') {
            console.log('[DEBUG] ⚠️ "We ran into a problem" screen detected. Attempting to click "Try again" or reload meeting...');
            try {
                const tryAgainBtn = page.locator('button:has-text("Try again"), button:has-text("Rejoin"), button:has-text("Refresh")').first();
                if (await tryAgainBtn.isVisible({ timeout: 2000 })) {
                    await tryAgainBtn.click({ force: true });
                } else {
                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
                }
            } catch(e) {}
            await page.waitForTimeout(5000);
        } else if (isAdmitted === 'dropped') {
            console.log('[DEBUG] Call dropped immediately upon joining (Rejoin screen detected). Exiting early.');
            break; // will fall through to !admitted check and exit
        }
        // Check if lobby asks for student email verification ("Enter your email or phone number")
        try {
            const lobbyEmailInput = page.locator('input[placeholder*="email" i], input[type="email"], input[aria-label*="email" i]').first();
            if (options.creds && options.creds.email && await lobbyEmailInput.isVisible({ timeout: 1500 })) {
                console.log(`[DEBUG] Found email verification input in lobby! Entering ${options.creds.email}...`);
                await lobbyEmailInput.fill(options.creds.email);
                await page.waitForTimeout(500);
                const nextBtn = page.locator('button:has-text("Next"), input[value="Next"], button[type="submit"]').first();
                if (await nextBtn.isVisible({ timeout: 1500 })) {
                    await nextBtn.click({ force: true });
                    console.log('[DEBUG] Clicked Next on lobby email verification prompt.');
                } else {
                    await lobbyEmailInput.press('Enter');
                }
                await page.waitForTimeout(2000);
            }
        } catch(e) {}

        // Check if Teams web chat is displayed with an inline "Join" button in the active call banner
        try {
            const inlineJoin = page.locator('button[data-tid*="chat-calling-join"], button[data-tid*="calling-join"], [data-tid*="channel-meeting-join-button"], button:has-text("Join"):not(:has-text("Join now"))').first();
            if (await inlineJoin.isVisible({ timeout: 1500 })) {
                console.log('[DEBUG] Detected inline chat "Join" button in lobby loop! Clicking to launch meeting...');
                await inlineJoin.click({ force: true });
                await page.waitForTimeout(3000);
                await handlePrejoinMuteAndJoin(page);
            }
        } catch(e) {}

        // Check if prejoin modal / Join now button is visible during lobby loop (ONLY if not already waiting in lobby)
        if (isAdmitted !== 'in_lobby') {
            try {
                const prejoinJoinNow = page.locator('button[data-tid="prejoin-join-button"], button:has-text("Join now")').first();
                if (await prejoinJoinNow.isVisible({ timeout: 1500 })) {
                    console.log('[DEBUG] Detected "Join now" button in lobby loop! Ensuring mute and clicking...');
                    await handlePrejoinMuteAndJoin(page);
                }
            } catch(e) {}
        }

        // Capture live screenshot to Firebase onFrame & save local preview
        try {
            const shot = await page.screenshot({ type: 'jpeg', quality: 40 });
            if (options.onFrame) await options.onFrame('data:image/jpeg;base64,' + shot.toString('base64'));
            const accountTag = (options.creds && (options.creds.name || options.creds.accountId)) ? (options.creds.name || options.creds.accountId).replace(/[^a-zA-Z0-9]/g, '_') : 'user';
            const screenPath = path.join(OUTPUT_DIR, `lobby_${accountTag}_latest.jpg`);
            fs.writeFileSync(screenPath, shot);
        } catch(se) {}

        await page.waitForTimeout(10000);
        initLobbyWaitLoops++;
    }

    if (!admitted) {
        console.log('[DEBUG] Lobby timeout reached or admission denied before recording started. Exiting.');
        await browser.close();
        throw new Error('Meeting admission was not granted (Lobby timeout or denied by organizer).');
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

    // ---------- REPLACEMENT BLOCK (EXPAND STRATEGY ki jagah) ----------
    try {
      console.log('[DEBUG] Checking if call is in mini popup (PiP)...');
      let full = await isMeetingFullView(page);

      for (let attempt = 1; attempt <= 4 && !full; attempt++) {
        const pip = await findPipRect(page);
        console.log(`[DEBUG] Expand attempt ${attempt}. PiP:`, pip ? `${Math.round(pip.x)},${Math.round(pip.y)} ${Math.round(pip.w)}x${Math.round(pip.h)}` : 'not found');
        if (pip) console.log('[DEBUG-DUMP] PiP HTML:', pip.html); // isse exact data-tid mil jayega

        if (pip) {
          // 1) PiP ke andar expand/return type button dhundo
          const clicked = await page.evaluate(({ x, y, w, h }) => {
            const inside = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
              const r = b.getBoundingClientRect();
              return r.x >= x - 2 && r.y >= y - 2 && r.x + r.width <= x + w + 2 && r.y + r.height <= y + h + 2;
            });
            const hit = inside.find(b => /expand|full|return|go to call|open|maximi/i.test(
              (b.getAttribute('aria-label') || '') + ' ' + (b.getAttribute('title') || '') + ' ' + (b.getAttribute('data-tid') || '')
            ));
            if (hit) { hit.click(); return 'button:' + (hit.getAttribute('aria-label') || hit.getAttribute('data-tid')); }
            return null;
          }, pip);
          console.log('[DEBUG] PiP expand-button click:', clicked);

          // 2) Fallback: header ke TITLE text par click (top-left/center), top-right corner par nahi
          if (!clicked) {
            await page.mouse.click(pip.x + pip.w * 0.4, pip.y + 14);
          }
        }
        await page.waitForTimeout(2500);
        full = await isMeetingFullView(page);
      }

      console.log('[DEBUG] Full view status:', full ? '✅ FULL VIEW' : '⚠️ STILL COMPACT');

      // Agar abhi bhi compact hai to ek baar Teams Calendar/Store se bahar nikalne ke liye Escape
      if (!full) await page.keyboard.press('Escape');

      try {
        const shot = await page.screenshot({ type: 'jpeg', quality: 40 });
        if (options.onFrame) await options.onFrame('data:image/jpeg;base64,' + shot.toString('base64'));
      } catch (se) {}
    } catch (e) { console.log('[DEBUG] Meeting expand error:', e.message); }









    // Try to activate "Hide me" and "Full screen" using aggressive locators
    try {
      console.log('[DEBUG] Searching for View / Layout button safely inside meeting toolbar...');
      
      // Send keyboard shortcuts to force fullscreen mode in Teams
      try { await page.keyboard.press('Control+Shift+F'); } catch(e){}
      try { await page.keyboard.press('Alt+Shift+F'); } catch(e){}
      try { await page.keyboard.press('F11'); } catch(e){}
      try { await page.evaluate(() => document.documentElement.requestFullscreen().catch(() => {})); } catch(e){}

      // Look for View / View options / Layout button in meeting toolbar
      const viewCandidates = [
        page.locator('[data-tid="meeting-toolbar"] button, [data-tid="calling-status-bar"] button, [role="toolbar"] button').filter({ hasText: /^View$/i }).first(),
        page.locator('button[aria-label="View"], button[aria-label*="View" i], button[data-tid*="view" i]').first(),
        page.locator('button[aria-label*="Layout" i], button[data-tid*="layout" i]').first(),
        page.locator('[data-tid="more-options-button"], button[aria-label*="More" i]').first()
      ];
      
      let targetViewBtn = null;
      for (const cand of viewCandidates) {
        if (await cand.isVisible({ timeout: 1500 })) {
          targetViewBtn = cand;
          break;
        }
      }
      
      if (targetViewBtn) {
        await targetViewBtn.click({ force: true });
        console.log('[DEBUG] Clicked View / Layout button.');
        await page.waitForTimeout(1500);
        
        // Full Screen option
        const fullScreenBtn = page.locator('menuitem, button, div[role="menuitem"], span').filter({ hasText: /Full screen|Fullscreen|Enter full screen/i }).first();
        if (await fullScreenBtn.isVisible({ timeout: 1000 })) {
          await fullScreenBtn.click({ force: true });
          console.log('[DEBUG] Clicked Full screen menu item.');
          isNativeFullScreen = true;
          await page.waitForTimeout(1500);
          try { await targetViewBtn.click({ force: true }); await page.waitForTimeout(1500); } catch(e){}
        }
        
        // Check for Hide me directly
        const hideMeBtn = page.locator('menuitem, button, div[role="menuitem"], span').filter({ hasText: /Hide me|Hide self|Hide my video/i }).first();
        let hideMeClicked = false;
        
        if (await hideMeBtn.isVisible({ timeout: 1000 })) {
          await hideMeBtn.click({ force: true });
          console.log('[DEBUG] Clicked Hide me directly.');
          hideMeClicked = true;
        } else {
          // Try More options option
          const moreOptionsBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /More options/i }).first();
          if (await moreOptionsBtn.isVisible({ timeout: 1000 })) {
            await moreOptionsBtn.click({ force: true });
            console.log('[DEBUG] Clicked More options in View menu.');
            await page.waitForTimeout(1500);
            
            if (await hideMeBtn.isVisible({ timeout: 1000 })) {
              await hideMeBtn.click({ force: true });
              console.log('[DEBUG] Clicked Hide me after More options.');
              hideMeClicked = true;
            }
          }
        }
        
        if (!hideMeClicked) console.log('[DEBUG] Hide me button not found in menu.');
        await page.keyboard.press('Escape'); // close menu
      } else {
        console.log('[DEBUG] View/Layout button not found in toolbar.');
      }
    } catch (e) {
      console.log('[DEBUG] Could not click Hide me/Full screen:', e.message);
    }

    // Hide UI
    try {
      await page.keyboard.press('F11');
      
      const injectHider = async (frame) => {
        try {
          await frame.evaluate(() => {
            const style = document.createElement('style');
            style.id = 'bot-hider-style';
            style.textContent = `
    * { cursor: none !important; }
    
    /* Explicitly protect video stage and canvas from ever being hidden & ensure 100% full width */
    video,
    canvas,
    [data-tid="calling-roster-stage"],
    [data-tid="video-gallery"],
    [data-tid="meeting-canvas"],
    [data-tid="presentation-stage"],
    [data-tid="screen-sharing-canvas"],
    div[class*="calling-stage"],
    div[class*="video-gallery"] {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        pointer-events: auto !important;
        width: 100% !important;
        max-width: 100% !important;
        flex: 1 1 100% !important;
    }

    /* Hide top meeting controls toolbar, app headers, and call timer */
    #teams-app-header,
    header,
    [data-tid="app-header"],
    [data-tid="meeting-toolbar"],
    [data-tid="calling-control-bar"],
    [data-tid="call-controls"],
    [data-tid="calling-status-bar"],
    [data-tid="meeting-time"],
    [data-tid*="timer"],
    [role="toolbar"],
    div[class*="calling-header"],
    div[class*="control-bar"],
    div[class*="meeting-toolbar"],
    div[class*="meeting-time"],
    div[class*="call-timer"],
    .fui-Toolbar,
    [role="tooltip"],
    .fui-Tooltip,
    .ui-tooltip,
    div[data-tid^="toast"],
    div[data-tid^="banner"],
    [data-tid*="notification-banner"],
    [data-tid*="recording-notification"],
    .ts-toast-notification,
    [data-tid*="toast"],
    .fui-Toast,
    .fui-ToastContainer,
    div[class*="Toast"],
    div[class*="toast"],
    .ui-toast,
    .toast-container,
    .ts-toast-stack,
    div[aria-label*="notification" i],
    [data-tid*="lobby" i],
    [data-tid*="Lobby" i],
    [class*="lobby" i],
    [class*="Lobby" i],
    div[aria-label*="lobby" i],
    aside[aria-label*="lobby" i],
    section[aria-label*="lobby" i],
    [data-tid="banner"],
    [data-tid^="banner-"],
    div[class*="banner" i],
    aside[class*="banner" i],
    .fui-Banner,
    div[class*="lobby-notification"],
    div[class*="LobbyNotification"],
    div[class*="lobby-admission"],
    div[class*="LobbyAdmission"],
    /* Suppress and hide RTT (Real-Time Text) and live captions side panels from squeezing presentation stage */
    aside[aria-label*="Real-time text" i],
    aside[aria-label*="RTT" i],
    aside[data-tid*="rtt" i],
    div[aria-label*="Real-time text" i],
    div[aria-label*="RTT" i],
    [data-tid*="rtt-pane" i],
    [data-tid*="rtt-panel" i],
    [data-tid*="rtt-side" i],
    [data-tid*="rtt-container" i],
    [data-tid*="live-captions-pane" i],
    [data-tid*="captions-pane" i],
    div[class*="rtt-pane" i],
    div[class*="rtt-panel" i],
    div[class*="rttContainer" i],
    div[class*="rtt-container" i],
    div[class*="rttPane" i] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        height: 0 !important;
        max-height: 0 !important;
        overflow: hidden !important;
        pointer-events: none !important;
    }
`;
            if (!document.getElementById('bot-hider-style')) {
                document.head.appendChild(style);
            }

            setInterval(() => {
                try {
                    // Remove all title attributes to stop hover tooltips
                    document.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));

                    // Safely click dismiss on popups
                    const btns = document.querySelectorAll('button');
                    btns.forEach(btn => {
                        const t = (btn.textContent || '').trim().toLowerCase();
                        if (t === 'dismiss' || t === 'got it' || t === 'not now') {
                            try { btn.click(); } catch(e){}
                        }
                    });

                    // Helper to check if an element or any ancestor contains video/canvas
                    const isVideoContainer = (el) => {
                        if (!el) return false;
                        if (el.matches && el.matches('video, canvas, [data-tid="video-gallery"], [data-tid="calling-roster-stage"], [data-tid="meeting-canvas"], [data-tid="screen-sharing-canvas"], div[class*="calling-stage"], div[class*="video-gallery"]')) return true;
                        if (el.querySelector && el.querySelector('video, canvas, [data-tid="video-gallery"], [data-tid="calling-roster-stage"], [data-tid="meeting-canvas"]')) return true;
                        return false;
                    };

                    // Safely hide top meeting controls toolbar & call timer (never parent container of video/canvas)
                    const topControls = document.querySelectorAll('[role="toolbar"], [data-tid*="toolbar"], [data-tid="meeting-toolbar"], [data-tid="calling-control-bar"], [data-tid="calling-status-bar"], header, div[class*="calling-header"]');
                    topControls.forEach(ctrl => {
                        if (!isVideoContainer(ctrl)) {
                            ctrl.style.setProperty('display', 'none', 'important');
                            ctrl.style.setProperty('opacity', '0', 'important');
                            ctrl.style.setProperty('visibility', 'hidden', 'important');
                        }
                    });

                    // Dismiss/hide security banner card only (never parent container)
                    const banner = Array.from(document.querySelectorAll('div, section, header')).find(el => {
                        const text = (el.innerText || el.textContent || '').toLowerCase();
                        return (text.includes('same app, better security') || text.includes('teams.cloud.microsoft')) && !isVideoContainer(el);
                    });
                    if (banner) {
                        const closeBtn = banner.querySelector('button, [role="button"], svg, [aria-label*="Close" i], [aria-label*="Dismiss" i]');
                        if (closeBtn) { try { closeBtn.click(); } catch(e){} }
                        banner.style.setProperty('display', 'none', 'important');
                    }

                    // Hide Lobby & Toast cards safely (never parent container)
                    const toastCards = document.querySelectorAll(
                        '[role="alert"], [role="status"], [role="region"], [role="banner"], ' +
                        '[data-tid*="notification"], [data-tid*="toast"], [data-tid*="banner"], [data-tid*="lobby"], ' +
                        'aside, section, header, div[class*="Toast" i], div[class*="toast" i], div[class*="banner" i], div[class*="lobby" i]'
                    );
                    toastCards.forEach(el => {
                        if (isVideoContainer(el)) return;
                        const text = (el.innerText || el.textContent || '').toLowerCase();
                        if (
                            text.includes('waiting in the lobby') ||
                            text.includes('in the lobby') ||
                            text.includes('view lobby') ||
                            text.includes('recording has started') ||
                            text.includes('transcription has started') ||
                            text.includes('mic has been') ||
                            text.includes('unmute if you') ||
                            text.includes('camera has been') ||
                            text.includes("you're muted") ||
                            text.includes("you are muted") ||
                            text.includes("your mic is muted") ||
                            text.includes("allowed to unmute")
                        ) {
                            const closeBtn = el.querySelector('button, [role="button"], svg, [aria-label*="Close" i], [aria-label*="Dismiss" i]');
                            if (closeBtn) { try { closeBtn.click(); } catch(e){} }
                            el.style.setProperty('display', 'none', 'important');
                            el.style.setProperty('opacity', '0', 'important');
                            el.style.setProperty('visibility', 'hidden', 'important');
                            el.style.setProperty('pointer-events', 'none', 'important');
                            el.style.setProperty('position', 'absolute', 'important');
                            el.style.setProperty('left', '-9999px', 'important');
                            el.style.setProperty('height', '0px', 'important');
                            el.style.setProperty('width', '0px', 'important');
                        }
                    });

                    // Auto pop-out or close RTT (Real-Time Text) / live captions side panels to prevent shrinking video
                    const rttPopoutBtn = document.querySelector(
                        'button[aria-label*="Open RTT" i], button[aria-label*="Open captions" i], ' +
                        'button[aria-label*="new window" i], button[aria-label*="pop out" i], ' +
                        'button[title*="Open RTT" i], button[title*="in new window" i], ' +
                        'button[data-tid*="open-rtt"], button[data-tid*="popout-rtt"]'
                    );
                    if (rttPopoutBtn) {
                        try { rttPopoutBtn.click(); } catch(e){}
                    }

                    const rttCloseBtn = document.querySelector(
                        'button[aria-label*="Close real-time text" i], button[aria-label*="Close RTT" i], ' +
                        'button[aria-label*="Close captions" i], button[aria-label*="Close pane" i], ' +
                        '[data-tid*="rtt"] button[aria-label*="Close" i], [aria-label*="RTT" i] button[aria-label*="Close" i]'
                    );
                    if (rttCloseBtn) {
                        try { rttCloseBtn.click(); } catch(e){}
                    }

                    // Force any RTT side panel to 0 width & calling stage to 100% width
                    const rttPanels = document.querySelectorAll(
                        'aside[aria-label*="Real-time text" i], aside[aria-label*="RTT" i], aside[data-tid*="rtt" i], ' +
                        '[data-tid*="rtt-pane" i], [data-tid*="rtt-panel" i], [data-tid*="rtt-side" i], ' +
                        'div[class*="rtt-pane" i], div[class*="rtt-panel" i], div[class*="rttContainer" i], div[class*="rtt-container" i]'
                    );
                    rttPanels.forEach(p => {
                        p.style.setProperty('display', 'none', 'important');
                        p.style.setProperty('width', '0px', 'important');
                        p.style.setProperty('max-width', '0px', 'important');
                        p.style.setProperty('min-width', '0px', 'important');
                        p.style.setProperty('flex', '0 0 0px', 'important');
                        p.style.setProperty('visibility', 'hidden', 'important');
                    });

                    const activeStages = document.querySelectorAll('[data-tid="calling-roster-stage"], [data-tid="meeting-canvas"], [data-tid="presentation-stage"], div[class*="calling-stage"]');
                    activeStages.forEach(st => {
                        st.style.setProperty('width', '100%', 'important');
                        st.style.setProperty('max-width', '100%', 'important');
                        st.style.setProperty('flex', '1 1 100%', 'important');
                    });

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

    // ROSTER DEBUG DUMP FOR TEACHER SCORING & CLASS END DETECTION
    try {
      const html = await page.evaluate(() => {
        const r = document.querySelector('[data-tid="calling-roster-stage"], [data-tid="roster"], [id*="roster"]');
        return r ? r.outerHTML.slice(0, 6000) : 'roster not found';
      });
      console.log('[DEBUG-DUMP] ROSTER:', html);
    } catch(re) {}

    const bannerOffset = await dismissMigrationBanner(page);
    console.log('[DEBUG] Banner offset (px):', bannerOffset);
    await dismissRecordingNotifications(page);

    // Start FFmpeg
    if (options.onStatus) await options.onStatus('RECORDING');
    console.log('🎥 Starting FFmpeg recording for live class...');
    const recordMs = maxMs;
    const off = bannerOffset;   // 0 for normal ID, ~25-30 for college ID agar banner close na hua
    const cropF = isNativeFullScreen
      ? `crop=1280:${640 - off}:0:${145 + off},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`
      : `crop=1204:${604 - off}:76:${200 + off},scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2`;
    ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000), cropF);

    const startTime = Date.now();
    let loopCount = 0;
    let lobbyWaitLoops = 0;
    let aloneCount = 0;
    let noUiCount = 0;
    let exodusCount = 0;
    let smallMeetingDropCount = 0;
    let callDisconnectedCount = 0;
    let maxParticipants = 0;
    const recentCounts = [];
    
    const teacherScores = {};
    let lockedTeacher = null;
    let teacherMissingCount = 0;
    let noActivityCount = 0;
    
    while (Date.now() - startTime < recordMs) {
      await sleep(15000); // Check every 15 seconds
      await dismissRecordingNotifications(page);
      try {
        if (options.onFrame) {
            const buf = await page.screenshot({ type: 'jpeg', quality: 30 });
            await options.onFrame('data:image/jpeg;base64,' + buf.toString('base64'));
        }
      } catch (e) {}
      loopCount++;

      if (options.shouldStop && await options.shouldStop().catch(() => false)) {
        console.log('🛑 Remote stop signal received from Firebase. Exiting recording loop cleanly!');
        break;
      }

      // Anti-idle & wake up Teams toolbar so participant count & controls stay visible
      try {
        await page.mouse.move(400 + (loopCount % 10) * 30, 25 + (loopCount % 3) * 5);
      } catch (e) {}

      // Teacher Scoring & Smart Departure Detection
      try {
        const participantData = await page.evaluate(() => {
          const signals = {};
          let isSharing = false;

          function cleanName(raw) {
            if (!raw) return '';
            let s = raw.replace(/\s*\([^)]*\)/g, ' ')
                       .replace(/,\s*(?:mic\s*(?:muted|unmuted)|camera\s*(?:on|off)|speaking|presented|video)/gi, ' ')
                       .replace(/\s*(?:is\s*presenting|has\s*started\s*sharing|is\s*sharing\s*screen|'s\s*screen)/gi, ' ')
                       .replace(/\s+/g, ' ')
                       .trim();
            const blacklist = /^(people|leave|chat|react|more|view|apps|settings|device|mic|camera|share|raise|hand|hang\s*up|mute|unmute|participants|in\s*this\s*meeting|attendees|toolbar|calling|stage|screen|recording|banner|gallery)$/i;
            if (blacklist.test(s)) return '';
            if (s.length < 3 || s.length > 50) return '';
            if (!/^[A-Z]/.test(s)) return '';
            return s;
          }

          // 1. Check Screen Share Presenter
          const screenShareStage = document.querySelector('[data-tid="screen-share"], [data-tid="presentation-stage"], [data-tid*="sharing"], [class*="screen-share"], [data-tid="screen-sharing-canvas"]');
          if (screenShareStage || document.querySelector('video')) {
            isSharing = true;
          }

          // Check aria-labels and leaf text nodes for "X is presenting" / "X is sharing screen"
          const allElements = Array.from(document.querySelectorAll('[aria-label*="presenting" i], [aria-label*="sharing" i], [aria-label*="screen" i], span, p, h2, h3, div'));
          for (const el of allElements) {
            const aria = el.getAttribute('aria-label') || '';
            const leafText = el.children.length === 0 ? (el.textContent || '').trim() : '';
            const targetText = aria || leafText;
            if (!targetText) continue;

            const m = targetText.match(/([A-Z][a-zA-Z\s.]+?)\s+(?:is presenting|has started sharing|is sharing screen|'s screen)/i);
            if (m && m[1]) {
              const name = cleanName(m[1]);
              if (name) {
                signals[name] = (signals[name] || 0) + 6; // Screen share presenter = +6 pts
                isSharing = true;
                break;
              }
            }
          }

          // 2. Check Video Gallery / Participant Tiles & Avatars (Teams Fluent UI v9 & standard)
          const participantEls = document.querySelectorAll(
            '[data-tid*="participant"], [data-cid*="participant"], [data-tid*="stream"], ' +
            '[data-tid*="avatar"], [data-cid*="avatar"], [data-tid*="tile"], [data-cid*="tile"], ' +
            '[class*="video-tile"], [class*="participant"], [role="listitem"], ' +
            '[aria-label*="speaking" i], [aria-label*="muted" i]'
          );

          participantEls.forEach(el => {
            let rawLabel = el.getAttribute('aria-label') || el.getAttribute('title') || '';
            const nameEl = el.querySelector('span[data-tid="author"], span[class*="name"], div[class*="participant-name"], [data-tid*="name"], footer, figcaption');
            const nameText = nameEl ? (nameEl.textContent || '').trim() : '';
            if (!rawLabel) {
              rawLabel = nameText;
            } else if (nameText && !rawLabel.toLowerCase().includes(nameText.toLowerCase())) {
              rawLabel = nameText + ' ' + rawLabel;
            }
            if (!rawLabel) {
              const textContent = (el.innerText || '').split('\n').filter(s => s.trim().length > 2 && !/^(sg|m|p|a|\d|on hold)$/i.test(s));
              if (textContent.length > 0) rawLabel = textContent[0];
            }

            const name = cleanName(rawLabel);
            if (name) {
              let pts = 1;
              const html = (el.outerHTML || '').toLowerCase();
              const aria = rawLabel.toLowerCase();

              // Active speaker detection (+3 pts)
              if (aria.includes('speaking') || aria.includes('unmute') || html.includes('speaking') || !!el.querySelector('[class*="speaking"], [data-tid*="speaking"]')) {
                pts += 3;
              }
              // Active camera (+2 pts)
              if (el.querySelector('video') || html.includes('video') || aria.includes('camera on')) {
                pts += 2;
              }
              signals[name] = (signals[name] || 0) + pts;
            }
          });

          // 3. Check Live Captions / Subtitles if present
          const captionSpeakers = document.querySelectorAll('[data-tid="closed-captions-speaker"], [class*="caption-speaker"]');
          captionSpeakers.forEach(sp => {
            const name = cleanName(sp.textContent || '');
            if (name) {
              signals[name] = (signals[name] || 0) + 4; // Active talking in captions = +4 pts
            }
          });

          return { signals, isSharing };
        });

        const signals = participantData.signals || {};
        const isSharing = participantData.isSharing;

        // Accumulate scores continuously across the class
        for (const [name, score] of Object.entries(signals)) {
          teacherScores[name] = (teacherScores[name] || 0) + score;
        }

        if (loopCount % 4 === 0 && Object.keys(teacherScores).length > 0) {
          const topList = Object.entries(teacherScores).sort((a,b)=>b[1]-a[1]).slice(0, 3).map(([n,s])=>`${n}: ${s}pts`).join(', ');
          console.log(`[DEBUG] 🎓 Top speaker scores: ${topList}`);
        }

        // Lock / Update Teacher: User requested scoring window of at least 1:30 hours (90 mins)
        // because teachers sometimes join late (e.g. 1 hour late)
        const currentMinsElapsed = (Date.now() - startTime) / (60 * 1000);
        if (currentMinsElapsed <= 90 || !lockedTeacher) {
          let topTeacher = null;
          let maxScore = 0;
          for (const [name, score] of Object.entries(teacherScores)) {
            if (score > maxScore) {
              maxScore = score;
              topTeacher = name;
            }
          }

          if (topTeacher && maxScore >= 15) {
            if (lockedTeacher !== topTeacher) {
              lockedTeacher = topTeacher;
              console.log(`🎓 Locked Teacher Identified: "${lockedTeacher}" (Cumulative Score: ${maxScore})`);
            }

            if (signals[lockedTeacher] && loopCount % 8 === 0) {
              console.log(`[DEBUG] 👨‍🏫 Active teacher: "${lockedTeacher}"`);
            }
          }
        }
      } catch(te) {}
      
      // End meeting detection
      try {
        const stats = await page.evaluate(() => {
            const text = (document.body.textContent || "").toLowerCase();
            let ended = false;
            let currentCount = 0;
            if (
              text.includes("the meeting has ended") ||
              text.includes("meeting has ended") ||
              text.includes("meeting ended") ||
              text.includes("call ended") ||
              text.includes("was ended by organizer") ||
              text.includes("organizer ended") ||
              text.includes("you've left the meeting") ||
              text.includes("you left the meeting") ||
              text.includes("removed you from the meeting") ||
              text.includes("you were removed") ||
              text.includes("you're disconnected") ||
              (text.includes("rejoin") && !!document.querySelector('button[data-tid*="rejoin"], [data-tid="rejoin-button"]'))
            ) {
              ended = true;
            }

            // 1. Direct check on roster button badge/tile (e.g. data-tid="roster-button-tile" with text "15")
            const rosterTile = document.querySelector('[data-tid="roster-button-tile"], #roster-button [data-tid*="tile"]');
            if (rosterTile && rosterTile.textContent) {
              const n = parseInt(rosterTile.textContent.trim(), 10);
              if (!isNaN(n) && n > 0) currentCount = n;
            }

            // 2. Check roster button textContent (works even when toolbar has display: none)
            if (currentCount === 0) {
              const rosterBtn = document.querySelector('#roster-button, [data-tid="roster-button"], [data-inp="roster-button"], [aria-label*="participant" i], [aria-label*="people" i]');
              if (rosterBtn) {
                const labelText = ((rosterBtn.getAttribute('aria-label') || '') + ' ' + (rosterBtn.textContent || '')).toLowerCase();
                const numMatch = labelText.match(/(\d+)/);
                if (numMatch) {
                  currentCount = parseInt(numMatch[1], 10);
                }
              }
            }

            // 3. Fallback regex match across page textContent
            if (currentCount === 0) {
              if (text.includes("in this meeting (1)") || text.includes("attendees (1)") || text.includes("participants (1)") || text.includes("people (1)")) {
                currentCount = 1;
              }
              const match = text.match(/(?:in this meeting|attendees|participants|people)\s*\(?(\d+)\)?/i) || text.match(/(\d+)\s*(?:people|participants|attendees)/i);
              if (match) {
                currentCount = parseInt(match[1], 10);
              }
            }

            // 4. Count video/participant tiles in the gallery
            const galleryTiles = document.querySelectorAll('[data-tid="video-tile"], [data-cid="video-tile"], [class*="video-tile"], [class*="participant"], [data-tid="author"]');
            if (galleryTiles.length > 0 && galleryTiles.length > currentCount) {
              currentCount = galleryTiles.length;
            }
            
            // Active call stage indicators
            const hasCallStage = !!(
                document.querySelector('[data-tid="calling-roster-stage"], [data-tid="video-gallery"], [data-tid="meeting-canvas"], [data-tid="presentation-stage"], [data-tid="screen-sharing-canvas"]') ||
                document.querySelector('[data-tid="hang-up-btn"], [data-tid="leave-button"], [data-tid="call-hangup"], #hangup-button') ||
                document.querySelector('[data-tid="meeting-toolbar"], [data-tid="call-controls"]') ||
                galleryTiles.length > 0 ||
                document.querySelector('video')
            );

            // Bot in Lobby: ONLY true if the bot is NOT inside an active call stage AND text indicates this user is waiting for admission
            const inLobby = !hasCallStage && (
                text.includes("we've let people in the meeting know you're waiting") || 
                text.includes("when the meeting starts, we'll let people know") ||
                (text.includes("waiting in the lobby") && currentCount <= 1)
            );

            // In Teams Chat view (call ended / disconnected / switched to chat window)
            const inChatView = !hasCallStage && !!(
                document.querySelector('[data-tid="chat-list"], [data-tid="message-pane"], [data-tid="channel-pane"], [data-tid="chat-calling-join-button"]') ||
                text.includes('chat is turned off for this meeting') ||
                text.includes('recording has started') ||
                text.includes('did you leave by mistake') ||
                (text.includes('chat') && !hasCallStage)
            );
            
            // Waiting for others to join screen (Displayed when bot is alone on call stage)
            const isWaitingForOthers = 
              text.includes("waiting for others to join") ||
              text.includes("waiting for other people to join") ||
              text.includes("waiting for others") ||
              text.includes("someone should be here soon") ||
              text.includes("you're the only one here") ||
              text.includes("you are the only person here");

            if (isWaitingForOthers) {
              currentCount = 1;
            }

            // Check active presentation or screen sharing
            const isPresenting = !!document.querySelector(
              '[data-tid="presentation-stage"], [data-tid="screen-sharing-canvas"], [data-tid="screen-share"], [data-tid*="sharing"], [class*="screen-share"]'
            );

            // Check active video streaming (video element that is playing and has non-zero frame dimensions)
            const hasActiveVideo = Array.from(document.querySelectorAll('video')).some(v => v.videoWidth > 0 && !v.paused && v.readyState >= 2);

            return { ended, currentCount, inLobby, hasCallStage, inChatView, isWaitingForOthers, isPresenting, hasActiveVideo };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        const elapsedMins = (Date.now() - startTime) / (60 * 1000);

        if (currentCount > maxParticipants) {
            maxParticipants = currentCount;
        }

        if (loopCount % 4 === 0) {
            console.log(`[DEBUG] 👥 Current attendees: ${currentCount > 0 ? currentCount : 'toolbar hidden'} (Peak: ${maxParticipants})`);
        }

        // 1. Explicit Meeting Ended screen detection
        if (stats.ended) {
            console.log('🏁 Meeting ended screen detected (Organizer ended call or removed). Stopping recording.');
            meetingEnded = true;
        }

        // 2. Call Disconnected / Chat view detection (when call stage vanishes or disconnected from phone)
        if (!stats.inLobby && !stats.hasCallStage && (stats.inChatView || currentCount === 0) && loopCount > 4) {
            callDisconnectedCount++;
            console.log(`[DEBUG] Call stage not found (Call disconnected / returned to Chat) (${callDisconnectedCount}/3 checks - 45s)...`);
            if (callDisconnectedCount >= 3) {
                console.log('🚪 Call stage vanished for >45s. Meeting ended or disconnected from another device. Stopping recording.');
                meetingEnded = true;
            }
        } else {
            callDisconnectedCount = 0;
        }

        // 3. Bot is alone in meeting (Waiting for others screen OR 1 participant with no active media/speech/teacher)
        // CRITICAL FIX: NEVER treat currentCount === 0 as alone! In Teams web, 0 means toolbar auto-hid.
        const hasActiveSpeech = Object.keys(signals).length > 0;
        const isPresentingOrVideo = isSharing || stats.isPresenting || stats.hasActiveVideo;
        const isTeacherActive = !!(lockedTeacher && (
            signals[lockedTeacher] ||
            Object.keys(signals).some(k => k.toLowerCase().includes(lockedTeacher.toLowerCase()))
        ));

        // Alone only if:
        // A) Teams explicitly displays "Waiting for others to join" screen
        // B) count === 1 on call stage, AND no presentation/screen share is active, AND no video is playing, AND nobody is speaking, AND identified teacher is NOT active
        const isAlone = stats.isWaitingForOthers || (
            currentCount === 1 && stats.hasCallStage && !stats.inLobby && !isPresentingOrVideo && !hasActiveSpeech && !isTeacherActive
        );

        if (isAlone) {
            aloneCount++;

            // USER STRICT RULES:
            // 1. If genuine "Waiting for others to join" screen appeared after real class ran (peak >= 3 and elapsed >= 15m):
            //    Class is FINISHED! Leave promptly in 2 checks (30s) so bot exits immediately ("clas khatam hone me waiting aaye to turant left karna chahiye").
            // 2. If waiting screen did NOT appear (isWaitingForOthers: false), but count is 1 with no presentation/speech:
            //    Require at least 8 checks (2 mins) to guard against temporary roster flickers.
            // 3. If class hasn't started yet (peak < 3), teacher might be late. Bot MUST WAIT patiently up to 30 mins.
            const hadRealClass = maxParticipants >= 3 && elapsedMins >= 15;
            const requiredAloneChecks = stats.isWaitingForOthers ? (hadRealClass ? 2 : 8) : 8;
            const canExitAlone = hadRealClass || elapsedMins >= 30;

            if (canExitAlone) {
                console.log(`[DEBUG] Waiting/Alone screen detected after ${elapsedMins.toFixed(1)} mins (WaitingForOthers: ${!!stats.isWaitingForOthers}, count: ${currentCount}, peak: ${maxParticipants}) (${aloneCount}/${requiredAloneChecks} checks)...`);
                if (aloneCount >= requiredAloneChecks) {
                    console.log(`🎓 Meeting/Class finished! Bot alone on stage after ${elapsedMins.toFixed(1)} mins (Peak: ${maxParticipants}, WaitingForOthers: ${!!stats.isWaitingForOthers}). Stopping recording.`);
                    meetingEnded = true;
                }
            } else {
                if (aloneCount % 4 === 0) {
                    console.log(`[DEBUG] ⏳ Waiting for teacher/class to start (${elapsedMins.toFixed(1)}m / 30.0m mandatory minimum wait). Teacher late or early join, keeping recording active...`);
                }
            }
        } else {
            aloneCount = 0;
        }

        // 4. Almost empty meeting (<= 2 participants left when class was large, e.g. peak >= 20)
        // STRICT: Only after 30 minutes and no active presentation/speech!
        if (maxParticipants >= 20 && currentCount > 0 && currentCount <= 2 && elapsedMins >= 30 && !isPresentingOrVideo && !hasActiveSpeech) {
            smallMeetingDropCount++;
            console.log(`[DEBUG] Almost empty meeting: only ${currentCount} participants left (Peak: ${maxParticipants}) (${smallMeetingDropCount}/12 checks - 3 mins)...`);
            if (smallMeetingDropCount >= 12) {
                console.log(`🎓 Meeting almost empty (only ${currentCount} participants left for >3 minutes after ${elapsedMins.toFixed(1)}m). Stopping recording.`);
                meetingEnded = true;
            }
        } else if (currentCount > 2 || isPresentingOrVideo || hasActiveSpeech) {
            smallMeetingDropCount = 0;
        }

        // 5. USER REQUESTED 5-MINUTE MASS EXODUS RULE:
        // "achank se bahot sare log left ho jaaye to 5 min baad recording band kar dena"
        // If peak attendance was >= 15, and count drops to <= 25% of peak OR <= 5 participants:
        // (CRITICAL: currentCount MUST BE > 0 and class ran for at least 20 minutes!)
        const isMassExodus = (maxParticipants >= 15 && currentCount > 0 && elapsedMins >= 20 && (
            currentCount <= Math.max(3, Math.floor(maxParticipants * 0.25)) ||
            currentCount <= 5
        ));

        if (isMassExodus) {
            exodusCount++;
            const exodusElapsedMins = (exodusCount * 15 / 60).toFixed(1);
            console.log(`[DEBUG] 📉 Mass exodus in progress: ${currentCount} participants left (Peak: ${maxParticipants}) (${exodusCount}/20 checks - ${exodusElapsedMins}m / 5.0m)...`);
            if (exodusCount >= 20) { // 20 * 15s = 300s = 5 minutes
                console.log(`🎓 Class finished! Mass exodus confirmed: Participants dropped from peak ${maxParticipants} to ${currentCount} and stayed low for >5 minutes. Stopping recording!`);
                meetingEnded = true;
            }
        } else if (currentCount > 5) {
            exodusCount = 0;
        }

        // 6. Lobby Timeout Logic (30 minutes)
        // STRICT: Only applies if the bot is actually stuck in the lobby waiting to be admitted (!hasCallStage and currentCount <= 1)
        if (stats.inLobby && !stats.hasCallStage && currentCount <= 1) {
            lobbyWaitLoops++;
            if (lobbyWaitLoops > 120) {
                console.log(`[DEBUG] Lobby timeout reached (30 minutes without being admitted). Ending meeting.`);
                meetingEnded = true;
            }
        } else {
            lobbyWaitLoops = 0;
        }

        if (meetingEnded) {
          console.log('🏁 Meeting end condition met. Stopping recording and exiting.');
          break;
        }
      } catch (err) {
        console.error('[DEBUG] Error in attendee/meeting check loop:', err);
      }
    }

    try {
      console.log('🚪 Attempting to click Hang Up / Leave button to exit Teams class gracefully...');
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
        const leaveBtn = btns.find(b => {
          const tid = (b.getAttribute('data-tid') || '').toLowerCase();
          const label = ((b.getAttribute('aria-label') || '') + ' ' + (b.innerText || '')).toLowerCase();
          return tid.includes('hang-up') || tid.includes('leave') || tid.includes('hangup') || label.includes('hang up') || label === 'leave';
        });
        if (leaveBtn) leaveBtn.click();
      });
      await sleep(1500);
    } catch (le) {}

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

recordLiveClass.performInlineLogin = performInlineLogin;
module.exports = recordLiveClass;
