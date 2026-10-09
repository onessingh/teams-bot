import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add crop parameter to startRecorder
text = text.replace('async function startRecorder(outputPath, durationSeconds) {', 'async function startRecorder(outputPath, durationSeconds, cropFilter = \'crop=836:560:76:200\') {')
text = text.replace("'-vf', 'crop=836:560:76:200',", "'-vf', cropFilter,")

# 2. Add isFullScreen variable and track it
text = text.replace("let maxParticipants = 0;", "let maxParticipants = 0;\n    let isNativeFullScreen = false;")

# In the view logic, set isNativeFullScreen = true
view_logic_old = '''            // Full Screen option
            const fullScreenBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /Full screen/i }).first();
            if (await fullScreenBtn.isVisible({ timeout: 1000 })) {
                await fullScreenBtn.click();
                console.log('[DEBUG] Clicked Full screen.');
                await page.waitForTimeout(1500);
                // Click View again because menu closes
                await targetViewBtn.click();
                await page.waitForTimeout(1500);
            }'''

view_logic_new = '''            // Full Screen option
            const fullScreenBtn = page.locator('menuitem, button, div[role="menuitem"]').filter({ hasText: /Full screen/i }).first();
            if (await fullScreenBtn.isVisible({ timeout: 1000 })) {
                await fullScreenBtn.click();
                console.log('[DEBUG] Clicked Full screen.');
                isNativeFullScreen = true;
                await page.waitForTimeout(1500);
                // Click View again because menu closes
                await targetViewBtn.click();
                await page.waitForTimeout(1500);
            }'''
text = text.replace(view_logic_old, view_logic_new)

# 3. Pass cropFilter to startRecorder
start_rec_old = "ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000));"
start_rec_new = "const cropF = isNativeFullScreen ? 'crop=960:720:0:85' : 'crop=836:560:76:200';\n      ffmpeg = await startRecorder(outputPath, Math.floor(recordMs / 1000), cropF);"
text = text.replace(start_rec_old, start_rec_new)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
