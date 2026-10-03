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
    '-vf', 'crop=1280:720:0:85',
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
        '--use-fake-device-for-media-stream'
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
        const joinOnWeb = page.locator('button[data-tid="joinOnWeb"], [data-tid="joinOnWeb"]');
        if (await joinOnWeb.isVisible({ timeout: 10000 })) {
            console.log('[DEBUG] Clicking "Continue on this browser"');
            await joinOnWeb.click();
            await page.waitForTimeout(5000);
        }
    } catch(e) {}

    // 2. Pre-join screen (Turn off Mic/Cam, Click Join Now)
    try {
        // Wait for pre-join screen to load
        await page.waitForSelector('button[data-tid="prejoin-join-button"]', { timeout: 30000 });
        console.log('[DEBUG] Pre-join screen loaded.');
        
        // Ensure mic is muted (aria-checked="true" means it's ON)
        const micToggle = page.locator('div[data-tid="toggle-mute"]');
        if (await micToggle.isVisible()) {
            const isMicOn = await micToggle.getAttribute('aria-checked');
            if (isMicOn === 'true') {
                console.log('[DEBUG] Muting Microphone');
                await micToggle.click();
            }
        }

        // Ensure camera is off
        const camToggle = page.locator('div[data-tid="toggle-video"]');
        if (await camToggle.isVisible()) {
            const isCamOn = await camToggle.getAttribute('aria-checked');
            if (isCamOn === 'true') {
                console.log('[DEBUG] Turning off Camera');
                await camToggle.click();
            }
        }

        console.log('[DEBUG] Clicking "Join now"');
        await page.locator('button[data-tid="prejoin-join-button"]').click();
    } catch(e) {
        console.log('[DEBUG] Pre-join button not found, maybe already joined or login blocked.', e.message);
    }

    await page.waitForTimeout(10000);

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
      await page.evaluate(() => {
        const style = document.createElement('style');
        style.innerHTML = '* { cursor: none !important; } .fui-Toolbar, [data-tid="call-controls-toolbar"], .ts-calling-screen-header { opacity: 0 !important; display: none !important; pointer-events: none !important; }';
        document.head.appendChild(style);
      });
    } catch(e) {}
    await page.mouse.move(0, 0);

    // Start FFmpeg
    console.log('🎥 Starting FFmpeg recording for live class...');
    const recordMs = maxMs;
    ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000));

    const startTime = Date.now();
    let loopCount = 0;
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
        const meetingEnded = await page.evaluate(() => {
            const text = document.body.innerText || "";
            if (text.includes("The meeting has ended") || text.includes("was ended") || text.includes("You've left the meeting")) {
                return true;
            }
            // Smart Organizer Detection: Check if "Organizer" or "Presenter" group is missing from the list
            const roster = document.querySelector('[data-tid="roster-participant-list"]');
            if (roster && text.includes("Attendees")) {
                if (!text.includes("Organizer") && !text.includes("Presenter")) {
                    // Organizer and Presenters have left, only attendees remain
                    return true;
                }
            }
            return false;
        });
        
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
