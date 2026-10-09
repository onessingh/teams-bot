import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''    // Open Roster / Participants to monitor count
    try {
        const rosterBtn = page.locator('button[id="roster-button"], button[aria-label="Participants"], button[aria-label="People"], button[id="people-button"], button:has-text("People")').first();
        if (await rosterBtn.isVisible({ timeout: 5000 })) {
            await rosterBtn.click();
            console.log('[DEBUG] Opened Participants (People) list.');
        }
    } catch (e) {}'''

text = re.sub(r'\s*// Open Roster / Participants to monitor Organizer\s*try \{\s*const rosterBtn = page\.locator\([^)]+\);\s*if \(await rosterBtn\.isVisible\(\{ timeout: 5000 \}\)\) \{\s*await rosterBtn\.click\(\);\s*console\.log\(\'\[DEBUG\] Opened Participants list\.\'\);\s*\}\s*\} catch \(e\) \{\}', '\n' + replacement, text)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
