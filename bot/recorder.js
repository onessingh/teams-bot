const { chromium } = require('playwright');
const { spawn } = require('child_process');

async function recordClass(url, outputPath) {
    let cookies = JSON.parse(Buffer.from(process.env.MS_COOKIES_BASE64, 'base64').toString('utf-8'));
    
    const browser = await chromium.launch({
        headless: false,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--autoplay-policy=no-user-gesture-required', '--disable-gpu']
    });

    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await context.addCookies(cookies);
    const page = await context.newPage();

    console.log("Navigating to Teams...");
    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    await page.waitForTimeout(10000);

    try {
        await page.click('button[aria-label="Play"]', { timeout: 5000 });
    } catch(e) { /* Ignore if already playing */ }

    console.log("Starting Capture...");
    const ffmpegProcess = spawn('ffmpeg', [
        '-y', '-f', 'x11grab', '-video_size', '1280x720', '-framerate', '15', 
        '-i', ':99', '-f', 'pulse', '-i', 'default', 
        '-c:v', 'libx264', '-preset', 'ultrafast', '-pix_fmt', 'yuv420p', 
        '-c:a', 'aac', '-b:a', '128k', outputPath
    ]);

    // Record for 2 hours (7200000 ms)
    await page.waitForTimeout(2 * 60 * 60 * 1000); 

    ffmpegProcess.kill('SIGINT');
    await new Promise(resolve => ffmpegProcess.on('close', resolve));
    await browser.close();
}

module.exports = { recordClass };
