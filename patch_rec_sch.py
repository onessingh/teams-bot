import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''
    // Strict Timer Check
    if (options.scheduledTime && Date.now() < options.scheduledTime) {
        const waitMs = options.scheduledTime - Date.now();
        console.log(`[DEBUG] Joined early. Waiting ${Math.floor(waitMs/1000)}s until scheduled time to start recording...`);
        await page.waitForTimeout(waitMs);
    }

    // Start FFmpeg'''

text = text.replace('    // Start FFmpeg', replacement.strip('\n'))

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
