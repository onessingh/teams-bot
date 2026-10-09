with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_view = """    console.log('[DEBUG] Searching for View button...');
        const viewBtn = page.locator('button').filter({ hasText: /^View$/ }).first();
        const viewBtnFallback = page.locator('button[aria-label*="View"], button[data-tid*="view"]').first();
        const targetViewBtn = (await viewBtn.isVisible({ timeout: 2000 })) ? viewBtn : viewBtnFallback;
        
        if (await targetViewBtn.isVisible({ timeout: 2000 })) {"""

new_view = """    console.log('[DEBUG] Searching for View button safely inside meeting toolbar...');
        // ONLY look for View inside the actual meeting toolbar to avoid clicking "View Apps" in Teams sidebar!
        const viewBtn = page.locator('[data-tid="meeting-toolbar"] button, [data-tid="calling-status-bar"] button, [id="roster-button"]~button, button[aria-label="View"]').filter({ hasText: /^View$/i }).first();
        const viewBtnFallback = page.locator('[data-tid="meeting-toolbar"] button[aria-label*="View"], [data-tid="meeting-toolbar"] button[data-tid*="view"]').first();
        const targetViewBtn = (await viewBtn.isVisible({ timeout: 2000 })) ? viewBtn : viewBtnFallback;
        
        if (await targetViewBtn.isVisible({ timeout: 2000 })) {"""

code = code.replace(old_view, new_view)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Fixed View button locator to prevent rogue navigation.")
