with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

insert_code = '''
        // If cookies are invalid, Teams might ask for a guest name before enabling the Join button
        try {
            const nameInput = page.locator('input[data-tid="prejoin-display-name-input"]');
            if (await nameInput.isVisible({ timeout: 2000 })) {
                console.log('[DEBUG] Guest name input found. Typing name to enable Join button...');
                await nameInput.fill('Class Bot');
                await page.waitForTimeout(1000);
            }
        } catch (e) {}

        // Ensure mic is muted (aria-checked="true" means it's ON)
        try {
            const micToggle = page.locator('[data-tid="toggle-mute"]');
            if (await micToggle.isVisible({ timeout: 2000 })) {
                const isMicOn = await micToggle.getAttribute('aria-checked');
                if (isMicOn === 'true') {
                    console.log('[DEBUG] Muting Microphone before joining...');
                    await micToggle.click({ force: true });
                    await page.waitForTimeout(1000);
                }
            }
        } catch(e) {
            console.log('[DEBUG] Mic toggle not found on prejoin');
        }

        // Ensure camera is off
        try {
            const camToggle = page.locator('[data-tid="toggle-video"]');
            if (await camToggle.isVisible({ timeout: 2000 })) {
                const isCamOn = await camToggle.getAttribute('aria-checked');
                if (isCamOn === 'true') {
                    console.log('[DEBUG] Turning off Camera before joining...');
                    await camToggle.click({ force: true });
                    await page.waitForTimeout(1000);
                }
            }
        } catch(e) {
            console.log('[DEBUG] Cam toggle not found on prejoin');
        }

'''

text = text.replace('        console.log(\'[DEBUG] Clicking "Join now"\');', insert_code + '        console.log(\'[DEBUG] Clicking "Join now"\');')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
