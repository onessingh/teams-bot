import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_view = '''    // Try to activate "Hide me" so bot's avatar doesn't take up space
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
    }'''

new_view = '''    // Try to activate "Hide me" and "Full screen" using aggressive locators
    try {
        console.log('[DEBUG] Searching for View button...');
        const viewBtn = page.locator('button').filter({ hasText: /^View$/ }).first();
        const viewBtnFallback = page.locator('button[aria-label*="View"], button[data-tid*="view"]').first();
        const targetViewBtn = (await viewBtn.isVisible({ timeout: 2000 })) ? viewBtn : viewBtnFallback;
        
        if (await targetViewBtn.isVisible({ timeout: 2000 })) {
            await targetViewBtn.click();
            console.log('[DEBUG] Clicked View button.');
            await page.waitForTimeout(1500);
            
            // Full Screen option
            const fullScreenBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /Full screen/i }).first();
            if (await fullScreenBtn.isVisible({ timeout: 1000 })) {
                await fullScreenBtn.click();
                console.log('[DEBUG] Clicked Full screen.');
                await page.waitForTimeout(1500);
                // Click View again because menu closes
                await targetViewBtn.click();
                await page.waitForTimeout(1500);
            }
            
            // More options option
            const moreOptionsBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /More options/i }).first();
            if (await moreOptionsBtn.isVisible({ timeout: 1000 })) {
                await moreOptionsBtn.click();
                console.log('[DEBUG] Clicked More options.');
                await page.waitForTimeout(1500);
            }
            
            // Hide me option
            const hideMeBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /Hide me/i }).first();
            if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                await hideMeBtn.click();
                console.log('[DEBUG] Clicked Hide me to remove bot avatar from grid.');
            } else {
                console.log('[DEBUG] Hide me button not found in menu.');
            }
            
            await page.mouse.click(0, 0); // close menu
        } else {
            console.log('[DEBUG] View button not found entirely.');
        }
    } catch (e) {
        console.log('[DEBUG] Could not click Hide me/Full screen:', e.message);
    }'''

text = text.replace(old_view, new_view)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
