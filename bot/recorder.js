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
  const selectors = [
    'button[aria-label*="Play" i]',
    '[role="button"][aria-label*="Play" i]',
    'button[title*="Play" i]',
    '[data-tid*="play" i]'
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
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--autoplay-policy=no-user-gesture-required',
        '--disable-gpu',
        '--disable-dev-shm-usage',
        '--window-size=1280,720'
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

    console.log('🌐 Opening Teams recording...');
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForTimeout(8000);

    if (/login|signin|authorize/i.test(page.url())) {
      throw new Error('Teams session appears to be expired or login is required. Re-login from the dashboard.');
    }

    await page.bringToFront();

    const clicked = await clickPlay(page);
    const playback = await waitForPlayback(page, 15000);
    if (!clicked && !playback) {
      throw new Error('Could not start Teams playback. Check the recording URL and saved Teams session.');
    }

    // Start capture only after playback has been requested/confirmed.
    ffmpeg = await startRecorder(outputPath, maxMs);

    console.log('⏺️ Recording in progress...');
    await sleep(maxMs);

    await stopRecorder(ffmpeg);
    ffmpeg = null;

    if (!fs.existsSync(outputPath) || fs.statSync(outputPath).size < 1024) {
      throw new Error('Recording file was not created or is empty.');
    }

    console.log(`✅ Recording saved: ${outputPath} (${fs.statSync(outputPath).size} bytes)`);
    return outputPath;
  } finally {
    if (ffmpeg) await stopRecorder(ffmpeg).catch(() => {});
    if (browser) await browser.close().catch(() => {});
  }
}

module.exports = { recordClass };
