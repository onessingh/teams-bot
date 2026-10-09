import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

# Remove the People panel opener entirely
old = """    // Open Roster / Participants to monitor count
    try {
        const rosterBtn = page.locator('button[id="roster-button"], button[aria-label="Participants"], button[aria-label="People"], button[id="people-button"], button:has-text("People")').first();
        if (await rosterBtn.isVisible({ timeout: 5000 })) {
            await rosterBtn.click();
            console.log('[DEBUG] Opened Participants (People) list.');
        }
    } catch (e) {}"""

new = """    // IMPORTANT: Do NOT click People/Participants - in new Teams this opens
    // "All contacts" sidebar instead of the in-meeting panel. Count is tracked via text.
    console.log('[DEBUG] Skipping People panel open (causes All Contacts sidebar).');"""

if old in code:
    code = code.replace(old, new)
    print("People panel replaced!")
else:
    print("People panel NOT FOUND - trying normalize")
    # Normalize
    code_n = code.replace('\r\n', '\n')
    old_n = old.replace('\r\n', '\n')
    if old_n in code_n:
        code_n = code_n.replace(old_n, new)
        code = code_n
        print("People panel replaced (normalized)!")
    else:
        print("STILL NOT FOUND")

# Now inject click-on-meeting-window BEFORE the All Contacts escape check
old2 = """    // Step 0: Close 'All contacts' sidebar if it's covering the screen
    try {
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts') || bodyText.toLowerCase().includes('find a contact')) {
            console.log('[DEBUG] "All Contacts" sidebar is open - pressing Escape to close...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) {}"""

new2 = """    // Step 0a: Click on the meeting mini-window to bring it to focus
    try {
        console.log('[DEBUG] Trying to focus/expand meeting mini-window...');
        const focused = await page.evaluate(() => {
            const pip = document.querySelector('[data-tid="calls-pip"]');
            if (pip) { pip.click(); return 'pip clicked'; }
            const meetingHeader = document.querySelector('[data-tid="calling-status-bar"], [data-tid="meeting-header"]');
            if (meetingHeader) { meetingHeader.click(); return 'header clicked'; }
            const callingDivs = Array.from(document.querySelectorAll('[class*="calling-"][class*="container"], [data-tid*="calling"]'));
            if (callingDivs.length > 0) { callingDivs[0].click(); return 'calling div clicked'; }
            return 'nothing found';
        });
        console.log('[DEBUG] Meeting focus result:', focused);
        await page.waitForTimeout(1500);
    } catch(e) { console.log('[DEBUG] Meeting focus error:', e.message); }

    // Step 0b: Close 'All contacts' sidebar if it's covering the screen
    try {
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts') || bodyText.toLowerCase().includes('find a contact')) {
            console.log('[DEBUG] "All Contacts" sidebar is open - pressing Escape to close...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) {}"""

code_n = code.replace('\r\n', '\n')
old2_n = old2.replace('\r\n', '\n')
if old2_n in code_n:
    code_n = code_n.replace(old2_n, new2)
    code = code_n
    print("All contacts block updated!")
else:
    print("All contacts block NOT FOUND")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Done!")
