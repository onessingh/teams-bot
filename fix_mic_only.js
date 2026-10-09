const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

const fixMic = `
    // Double check mic is muted inside the meeting
    try {
        console.log('[DEBUG] Checking mic status...');
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = (await inMeetingMic.getAttribute('aria-label')) || '';
            
            const isUnmuted = ariaChecked === 'false' || ariaLabel.toLowerCase().startsWith('mute');
            
            console.log('[DEBUG] Mic unmuted status:', isUnmuted, '(aria-checked:', ariaChecked, ', aria-label:', ariaLabel, ')');
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now via click!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
                
                const checkAria = await inMeetingMic.getAttribute('aria-checked');
                console.log('[DEBUG] Mic status after click is now (aria-checked):', checkAria);
            } else {
                console.log('[DEBUG] Mic is already muted.');
            }
        } else {
             console.log('[DEBUG] Mic button not found on screen.');
             await page.keyboard.press('Control+Shift+M');
        }
    } catch(e) {
        console.log('[DEBUG] Mic verify error:', e.message);
    }
`;

content = content.replace(/try \{[\s\S]*?console\.log\('\[DEBUG\] Mic status after click is now:', checkAria\);\s*\}/, fixMic);

fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
