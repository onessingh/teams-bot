const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

const uiSetupCode = `
    // Try to expand PiP if stuck in mini-window
    try {
        console.log('[DEBUG] Checking if stuck in PiP window...');
        await page.evaluate(() => {
            const returnBtns = Array.from(document.querySelectorAll('button')).filter(b => 
                (b.getAttribute('aria-label') || '').toLowerCase().includes('return to meeting') ||
                (b.getAttribute('title') || '').toLowerCase().includes('return to meeting') ||
                (b.getAttribute('aria-label') || '').toLowerCase().includes('back to meeting')
            );
            if (returnBtns.length > 0) {
                returnBtns[0].click();
            } else {
                // Try clicking the mini-player container directly
                const miniPlayer = document.querySelector('[data-tid="calls-pip"], .app-svg'); 
                if (miniPlayer) miniPlayer.click();
            }
        });
        await page.waitForTimeout(2000);
    } catch(e) {}
`;

code = code.replace("console.log('[DEBUG] Searching for View button...');", uiSetupCode + "\n    console.log('[DEBUG] Searching for View button...');");
fs.writeFileSync('bot/live-recorder.js', code);
console.log("Patched PiP expansion.");
