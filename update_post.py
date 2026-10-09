with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_post_join_mic = r'''    // Double check mic is muted inside the meeting.*?    } catch\(e\) \{\}'''
new_post_join_mic = '''    // Double check mic is muted inside the meeting
    try {
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = await inMeetingMic.getAttribute('aria-label');
            const isUnmuted = ariaChecked === 'true' || (ariaLabel && ariaLabel.toLowerCase().includes('mute') && !ariaLabel.toLowerCase().includes('unmute'));
            
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now!');
                // Try keyboard shortcut first (Ctrl+Shift+M) as it is very reliable
                await page.keyboard.press('Control+Shift+M');
                await page.waitForTimeout(1000);
                
                // If still unmuted by checking state, try clicking it
                const stillUnmuted = await inMeetingMic.getAttribute('aria-checked') === 'true';
                if (stillUnmuted) {
                     await inMeetingMic.click({ force: true });
                }
            }
        } else {
            // Just blind fire Ctrl+Shift+M just in case we couldn't find the button but it's on
            console.log('[DEBUG] Mic button not found, blind firing Ctrl+Shift+M to mute...');
            await page.keyboard.press('Control+Shift+M');
        }
    } catch(e) {}'''

text = re.sub(old_post_join_mic, new_post_join_mic, text, flags=re.DOTALL)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
