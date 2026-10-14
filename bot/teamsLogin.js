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
            const pwdSelector = '#passwordEntry, #i0118, input[name="passwd"], input[type="password"]';
            const bypassSelector = '#idA_PWD_SwitchToPassword, #idA_PWD_SwitchToCredPicker, a:has-text("password"), button:has-text("password"), span:has-text("Use your password")';

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

            // Wait for password submission to process
            await page.waitForTimeout(3000);
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
            await page.waitForSelector('#idRemoteNGC_DisplaySign, #idRichContext_DisplaySign', { timeout: 4000 });
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
            const staySignedBtn = page.locator('#idSIButton9, input[value="Yes"], button:has-text("Yes"), input[type="submit"][value="Yes"]').first();
            if (await staySignedBtn.isVisible({ timeout: 5000 })) {
                console.log("Clicking 'Yes' on Stay signed in prompt to get persistent auth cookies...");
                await staySignedBtn.click({ force: true });
                await page.waitForTimeout(5000);
            }
        } catch(e) {}

        // Wait for login redirection to finish (wait until URL leaves login.live.com / login.microsoftonline.com)
        console.log("Waiting for Microsoft login redirect to complete...");
        try {
            await page.waitForURL(url => !url.href.includes('login.live.com') && !url.href.includes('login.microsoftonline.com'), { timeout: 15000 });
        } catch(e) {
            console.log("Redirect wait note (continuing):", e.message);
        }

        // Wait for Teams web app to finish initializing
        console.log("Current URL after login:", page.url());
        try {
            if (!page.url().includes('teams.microsoft.com') && !page.url().includes('teams.cloud.microsoft')) {
                console.log("Navigating to Teams v2 web client...");
                await page.goto('https://teams.microsoft.com/v2/', { waitUntil: 'domcontentloaded', timeout: 30000 });
            }
            await page.waitForTimeout(6000);
        } catch(e) {
            console.log("Navigation to Teams note:", e.message);
        }

        console.log("Validating successful login...");
        // Ensure we are not still on the login page
        const isStillLogin = await page.locator('input[type="email"]').isVisible().catch(()=>false);
        if (isStillLogin) throw new Error("Stuck on email page. Incorrect email?");
        
        console.log("Login seems successful, extracting cookies and storage state...");
        const cookies = await context.cookies();
        let storageState = null;
        try {
            storageState = await context.storageState();
        } catch(e) {}
        
        await db.ref(`config/${targetKey}`).update({ 
            cookies: cookies,
            storageState: storageState,
            updatedAt: Date.now()
        });
        await db.ref('state/login_status').set('SUCCESS');
        console.log(`Saved ${cookies.length} cookies and full storageState to Firebase for ${targetKey}!`);

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

