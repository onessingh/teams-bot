import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

hide_me_logic = '''    // Try to activate "Hide me" so bot's avatar doesn't take up space
    try {
        const viewBtn = page.locator('button[aria-label="View"], button[name="View"]').first();
        if (await viewBtn.isVisible({ timeout: 2000 })) {
            await viewBtn.click();
            await page.waitForTimeout(1000);
            
            // Sometimes it's under More options
            const moreOptionsBtn = page.locator('menuitem[aria-label="More options"], button:has-text("More options")').first();
            if (await moreOptionsBtn.isVisible({ timeout: 1000 })) {
                await moreOptionsBtn.click();
                await page.waitForTimeout(1000);
            }
            
            const hideMeBtn = page.locator('menuitem[aria-label="Hide me"], button:has-text("Hide me"), div:has-text("Hide me")').last();
            if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                await hideMeBtn.click();
                console.log('[DEBUG] Clicked "Hide me" to remove bot avatar from grid.');
            }
            
            // Click body to close any remaining menus
            await page.mouse.click(0, 0);
        }
    } catch (e) {
        console.log('[DEBUG] Could not click Hide me:', e.message);
    }
'''

# Insert right before "// Hide UI"
text = text.replace('    // Hide UI', hide_me_logic + '\n    // Hide UI')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
