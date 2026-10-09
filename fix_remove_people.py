with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

# Remove the bad People button click that opens All Contacts
old = """    // Open Roster / Participants to show on the right side
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
    }"""

new = """    // NOTE: We do NOT open the People panel manually.
    // The participants list shows naturally on the right side when the meeting is in full view.
    // Clicking People button from mini-PiP state opens "All contacts" sidebar instead."""

code = code.replace(old, new)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Done!" if old in code else "NOT FOUND - checking...")
