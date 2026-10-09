import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove the PII ban blur that hides the participants list
old_blur = """    // Hide contact lists to prevent YouTube PII bans if stuck in PiP
    try {
        await page.addStyleTag({ content: 'table, [role="grid"], [role="list"], .fui-Tree { filter: blur(20px) !important; opacity: 0 !important; visibility: hidden !important; }' });
    } catch(e) {}"""

new_blur = """    // (Removed CSS blur so participants can be seen)"""
code = code.replace(old_blur, new_blur)


# 2. Add the code to click the People button AFTER fullscreen is set
old_fs = """    } catch (e) {
        console.log('[DEBUG] Could not click Hide me/Full screen:', e.message);
    }

    // Hide UI
    try {"""

new_fs = """    } catch (e) {
        console.log('[DEBUG] Could not click Hide me/Full screen:', e.message);
    }

    // Open Roster / Participants to show on the right side
    try {
        console.log('[DEBUG] Searching for in-meeting People button...');
        const peopleBtn = page.locator('button[id="roster-button"], button[aria-label="Participants"], button[aria-label="People"], button[data-tid="roster-btn"]').first();
        if (await peopleBtn.isVisible({ timeout: 5000 })) {
            await peopleBtn.click();
            console.log('[DEBUG] Opened Participants (People) list.');
            await page.waitForTimeout(2000);
        } else {
            console.log('[DEBUG] People button not found.');
        }
    } catch (e) {
        console.log('[DEBUG] Could not open Participants:', e.message);
    }

    // Hide UI
    try {"""

code = code.replace(old_fs, new_fs)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Applied!")
