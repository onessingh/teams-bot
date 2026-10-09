import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_view = '''            // More options option
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
            }'''

new_view = '''            // Check for Hide me directly
            const hideMeBtn = page.locator('menuitem, button, div[role="menuitem"], span').filter({ hasText: /Hide me/i }).first();
            let hideMeClicked = false;
            
            if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                await hideMeBtn.click();
                console.log('[DEBUG] Clicked Hide me directly.');
                hideMeClicked = true;
            } else {
                // Try More options option
                const moreOptionsBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /More options/i }).first();
                if (await moreOptionsBtn.isVisible({ timeout: 1000 })) {
                    await moreOptionsBtn.click();
                    console.log('[DEBUG] Clicked More options.');
                    await page.waitForTimeout(1500);
                    
                    if (await hideMeBtn.isVisible({ timeout: 1000 })) {
                        await hideMeBtn.click();
                        console.log('[DEBUG] Clicked Hide me after More options.');
                        hideMeClicked = true;
                    }
                }
            }
            
            if (!hideMeClicked) console.log('[DEBUG] Hide me button not found in menu.');'''
            
text = text.replace(old_view, new_view)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
