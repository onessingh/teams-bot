const { chromium } = require('playwright');
const admin = require('firebase-admin');

async function doTeamsLogin(db) {
    console.log("Starting Teams login flow...");
    
    // Update status
    await db.ref('state/login_status').set('IN_PROGRESS');

    const targetSnap = await db.ref('state/login_target').once('value');
    const targetKey = targetSnap.val() || 'teams_creds';
    const credsSnap = await db.ref('config/' + targetKey).once('value');
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
        console.log("Typing email...");
        await page.waitForSelector('input[type="email"]');
        await page.locator('input[type="email"]').pressSequentially(creds.email, { delay: 50 });
        await page.waitForTimeout(1000); 
        await page.locator('input[type="email"]').press('Enter');
        try {
            await page.click('#idSIButton9, input[type="submit"]', { timeout: 2000, force: true });
        } catch(e) {}

        // Password
        console.log("Waiting for password screen...");
        try {
            await page.waitForSelector('input[type="password"]', { timeout: 15000 });
            await page.locator('input[type="password"]').pressSequentially(creds.password, { delay: 50 });
            await page.waitForTimeout(1000);
            await page.locator('input[type="password"]').press('Enter');
            try {
                await page.click('#idSIButton9, input[type="submit"]', { timeout: 2000, force: true });
            } catch(e) {}
        } catch(e) {
            console.log("Password field not found. Saving screenshot for debugging.");
            const errImg = await page.screenshot({ type: 'jpeg', quality: 50, fullPage: true });
            await db.ref('state/mfa_screenshot').set("data:image/jpeg;base64," + errImg.toString('base64'));
            await page.waitForTimeout(3000); // Wait 3s to ensure Firebase finishes uploading the image!
            throw new Error("Password field not found. Check dashboard for screenshot of what Microsoft is asking.");
        }

        // Check for MFA screen (e.g. Authenticator App prompt)
        console.log("Checking for MFA...");
        try {
            await page.waitForSelector('#idRemoteNGC_DisplaySign', { timeout: 5000 });
            console.log("MFA Prompt detected!");
            
            const screenshotBuffer = await page.screenshot({ fullPage: false });
            const base64Image = "data:image/png;base64," + screenshotBuffer.toString('base64');
            
            await db.ref('state/mfa_screenshot').set(base64Image);
            await db.ref('state/login_status').set('WAITING_FOR_MFA');

            await page.waitForNavigation({ timeout: 60000 * 2 }); // wait up to 2 mins for approval
        } catch (e) {
            console.log("No MFA prompt or it auto-progressed.");
        }

        // 'Stay signed in?' prompt
        try {
            await page.waitForSelector('input[id="idBtn_Back"]', { timeout: 5000 });
            await page.click('input[id="idBtn_Back"]'); // click "No"
        } catch(e) {}

        console.log("Validating successful login...");
        // Ensure we are not still on the login page
        const isStillLogin = await page.locator('input[type="email"]').isVisible().catch(()=>false);
        if (isStillLogin) throw new Error("Stuck on email page. Incorrect email?");
        
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

