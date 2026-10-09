const { chromium } = require('playwright');
const fs = require('fs');

async function test() {
    const cookies = JSON.parse(fs.readFileSync('cookies.json', 'utf-8'));
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ permissions: ['microphone', 'camera'] });
    await context.addCookies(cookies);
    const page = await context.newPage();
    console.log('Navigating...');
    await page.goto('https://teams.live.com/meet/9318846008472?p=ylbjaJUSnIjXoouneC', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(10000); // Wait for page to settle
    
    // Check for join on web
    const joinOnWeb = page.locator('button[data-tid="joinOnWeb"], [data-tid="joinOnWeb"], button:has-text("Continue on this browser")').first();
    if (await joinOnWeb.isVisible()) {
        console.log('Clicking continue on browser...');
        await joinOnWeb.click();
        await page.waitForTimeout(10000);
    }
    
    console.log('Taking screenshot...');
    await page.screenshot({ path: 'test_screen.png' });
    await browser.close();
}
test();
