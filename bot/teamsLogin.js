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
        try {
            const pwdSelector = '#i0118, input[name="passwd"]';
            const bypassSelector = '#idA_PWD_SwitchToPassword, #idA_PWD_SwitchToCredPicker, a:has-text("password"), button:has-text("password")';

            console.log("Checking if 'Use your password' bypass is needed (waiting 3s)...");
            try {
                let bypass = page.locator('#idA_PWD_SwitchToPassword, #idA_PWD_SwitchToCredPicker').first();
                
                // Wait up to 3 seconds for the ID-based buttons
                let isBypassVisible = false;
                try {
                    await bypass.waitFor({ state: 'visible', timeout: 3000 });
                    isBypassVisible = true;
                } catch(e) {}
                
                // Fallback: Use Playwright's native getByText to find ANY element with the text (div, span, a, etc)
                if (!isBypassVisible) {
                    bypass = page.getByText('Use your password', { exact: false }).first();
                    try {
                        await bypass.waitFor({ state: 'visible', timeout: 1000 });
                        isBypassVisible = true;
                    } catch(e) {}
                }

                if (isBypassVisible) {
                    console.log("Found 'Use your password' bypass! Clicking it...");
                    await bypass.click({ force: true });
                    await page.waitForTimeout(2000);
                } else {
                    console.log("No bypass button detected. Proceeding directly to password.");
                }
            } catch(e) {
                console.log("Bypass check error:", e.message);
            }

            console.log("Waiting for password field to be ready...");
            const pwdInput = page.locator(pwdSelector).first();
            await pwdInput.waitFor({ state: 'visible', timeout: 15000 });
            
            console.log("Entering password...");
            await pwdInput.focus(); // Force focus just in case
            await pwdInput.pressSequentially(creds.password, { delay: 50 });
            await page.waitForTimeout(1000);
            await pwdInput.press('Enter');
            
            try {
                await page.click('#idSIButton9, input[type="submit"]', { timeout: 2000, force: true });
            } catch(e) {}
        } catch(e) {
            console.log("Login flow failed:", e.message);
            console.log("Saving screenshot for debugging.");
            const errImg = await page.screenshot({ type: 'jpeg', quality: 50, fullPage: true });
            await db.ref('state/mfa_screenshot').set("data:image/jpeg;base64," + errImg.toString('base64'));
            await page.waitForTimeout(3000); // Wait 3s for Firebase
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

        // 'Stay signed in?' prompt - CLICK YES TO GET PERSISTENT REFRESH COOKIES!
        try {
            console.log("Checking for 'Stay signed in?' prompt...");
            const staySignedBtn = page.locator('#idSIButton9, input[value="Yes"], input[type="submit"][value="Yes"]').first();
            if (await staySignedBtn.isVisible({ timeout: 5000 })) {
                console.log("Clicking 'Yes' on Stay signed in prompt to get persistent auth cookies...");
                await staySignedBtn.click({ force: true });
                await page.waitForTimeout(4000);
            }
        } catch(e) {}

        // Wait for Teams web app to finish initializing on teams.cloud.microsoft / v2
        console.log("Waiting for Teams Web app to finish loading...");
        try {
            await page.waitForURL(url => url.href.includes('teams.cloud.microsoft') || url.href.includes('/v2/') || url.href.includes('teams.microsoft.com'), { timeout: 15000 });
            await page.waitForTimeout(5000);
        } catch(e) {}

        console.log("Validating successful login...");
        // Ensure we are not still on the login page
        const isStillLogin = await page.locator('input[type="email"]').isVisible().catch(()=>false);
        if (isStillLogin) throw new Error("Stuck on email page. Incorrect email?");
        
        console.log("Login seems successful, extracting cookies...");
        const cookies = await context.cookies();
        
        await db.ref(`config/${targetKey}`).update({ cookies: cookies });
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

