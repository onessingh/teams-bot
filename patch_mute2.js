const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

// Replace prejoin mute
const prejoinMuteRegex = /if \(isMicOn\) \{[\s\S]*?console\.log\('\[DEBUG\] Mic is ON! Pressing Ctrl\+Shift\+M to mute\.\.\.'\);[\s\S]*?await page\.keyboard\.press\('Control\+Shift\+M'\);[\s\S]*?\}/;

const newPrejoinMute = `if (isMicOn) {
                console.log('[DEBUG] Mic is ON! Clicking the mute button directly...');
                await page.evaluate(() => {
                    const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                        (el.getAttribute('data-tid') === 'toggle-mute') ||
                        (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('microphone')) ||
                        (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('mute') && !el.getAttribute('aria-label').toLowerCase().includes('unmute'))
                    );
                    for (let btn of micBtns) {
                        if (btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('data-state') === 'unmuted' || (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').toLowerCase().includes('mute') && !btn.getAttribute('aria-label').toLowerCase().includes('unmute'))) {
                            btn.click();
                        }
                    }
                });
                await page.waitForTimeout(1000);
            }`;

code = code.replace(prejoinMuteRegex, newPrejoinMute);
fs.writeFileSync('bot/live-recorder.js', code);
console.log("Patched prejoin mute logic.");
