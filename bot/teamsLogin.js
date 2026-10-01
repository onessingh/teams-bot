const { chromium } = require('playwright');
const admin = require('firebase-admin');

async function doTeamsLogin(db) {
    console.log("Starting Teams login flow...");
    
    // Update status
    await db.ref('state/login_status').set('IN_PROGRESS');

    const credsSnap = await db.ref('config/teams_creds').once('value');
    const creds = credsSnap.val();
    
    if (!creds || !creds.email || !creds.password) {
        console.error("No credentials found!");
        await db.ref('state/login_status').set('FAILED');
        return;
    }

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();

    try {
        await page.goto('https://teams.microsoft.com');

        // Email
        await page.waitForSelector('input[type="email"]');
        await page.fill('input[type="email"]', creds.email);
        await page.click('input[type="submit"]');

        // Password
        await page.waitForSelector('input[type="password"]', { timeout: 10000 });
        await page.fill('input[type="password"]', creds.password);
        await page.click('input[type="submit"]');

        // Check for MFA screen (e.g. Authenticator App prompt)
        console.log("Checking for MFA...");
        try {
            await page.waitForSelector('#idRemoteNGC_DisplaySign', { timeout: 5000 });
            console.log("MFA Prompt detected!");
            
            // Take a screenshot of the number to approve
            const screenshotBuffer = await page.screenshot({ fullPage: false });
            const base64Image = "data:image/png;base64," + screenshotBuffer.toString('base64');
            
            await db.ref('state/mfa_screenshot').set(base64Image);
            await db.ref('state/login_status').set('WAITING_FOR_MFA');

            // Wait for user to approve on their phone and the page to navigate away
            await page.waitForNavigation({ timeout: 60000 * 2 }); // wait up to 2 mins for approval
        } catch (e) {
            console.log("No MFA prompt or it auto-progressed.");
        }

        // 'Stay signed in?' prompt
        try {
            await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 5000 });
            await page.click('input[id="idBtn_Back"]'); // click "No" to stay signed in (doesn't matter for cookies)
        } catch(e) {}

        // Wait for Teams web app to load
        await page.waitForSelector('div[data-tid="team-channel-list"]', { timeout: 30000 }).catch(() => {});

        console.log("Login seems successful, extracting cookies...");
        const cookies = await context.cookies();
        
        await db.ref('config/teams_cookies').set(cookies);
        await db.ref('state/login_status').set('SUCCESS');
        console.log("Cookies saved to Firebase!");

    } catch (err) {
        console.error("Login failed:", err);
        await db.ref('state/login_status').set('FAILED');
        
        const screenshotBuffer = await page.screenshot({ fullPage: true });
        const base64Image = "data:image/png;base64," + screenshotBuffer.toString('base64');
        await db.ref('state/mfa_screenshot').set(base64Image);
    } finally {
        await browser.close();
    }
}

module.exports = { doTeamsLogin };
