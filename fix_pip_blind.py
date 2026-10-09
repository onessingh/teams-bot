import re

with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_pip = """        // After expanding, close All contacts if still open
        await page.waitForTimeout(1000);
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts')) {
            console.log('[DEBUG] All Contacts still showing - pressing Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) { console.log('[DEBUG] PiP expand error:', e.message); }"""

new_pip = """        // After expanding, close All contacts if still open
        await page.waitForTimeout(1000);
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts')) {
            console.log('[DEBUG] All Contacts still showing - pressing Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
        
        // ULTIMATE FALLBACK: Blind click the top-left area where the PiP window floats
        // This physically clicks the center of the PiP to expand it if DOM locators failed
        console.log('[DEBUG] Blind clicking top-left area (150, 150) to force PiP expansion...');
        await page.mouse.click(150, 150);
        await page.waitForTimeout(1000);
        await page.mouse.click(200, 200);
        await page.waitForTimeout(1000);
        
    } catch(e) { console.log('[DEBUG] PiP expand error:', e.message); }"""

code = code.replace(old_pip, new_pip)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Added blind click fallback for PiP window.")
