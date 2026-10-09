const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

// Replace keyboard shortcut mute with direct click in the meeting UI
const meetingMuteRegex = /if \(isMicOn\) \{[\s\S]*?console\.log\('\[DEBUG\] Mic is ON in meeting! Pressing Ctrl\+Shift\+M to mute\.\.\.'\);[\s\S]*?await page\.keyboard\.press\('Control\+Shift\+M'\);[\s\S]*?\}/;

const newMeetingMute = `if (isMicOn) {
            console.log('[DEBUG] Mic is ON in meeting! Clicking the mute button directly...');
            await page.evaluate(() => {
                const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    (el.getAttribute('data-tid') === 'toggle-mute') ||
                    (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('microphone')) ||
                    (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('mute') && !el.getAttribute('aria-label').toLowerCase().includes('unmute'))
                );
                for (let btn of micBtns) {
                    btn.click();
                }
            });
            await page.waitForTimeout(1000);
        }`;

code = code.replace(meetingMuteRegex, newMeetingMute);
fs.writeFileSync('bot/live-recorder.js', code);
console.log("Patched meeting mute logic.");
