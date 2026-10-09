with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Extract the consent block
consent_start = -1
consent_end = -1
for i, line in enumerate(lines):
    if '// Attempt to clear any Unified Consent' in line:
        consent_start = i
    if 'console.log(\'[DEBUG] Clicking "Join now"\');' in line:
        consent_end = i - 1
        break

consent_block = lines[consent_start:consent_end+1]
del lines[consent_start:consent_end+1]

# Find where to insert it (right after pre-join screen loaded)
insert_idx = -1
for i, line in enumerate(lines):
    if 'await page.waitForTimeout(3000); // Give toggles time to initialize' in line:
        insert_idx = i + 1
        break

lines = lines[:insert_idx] + consent_block + lines[insert_idx:]

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
