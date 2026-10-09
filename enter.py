with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''
        console.log('[DEBUG] Clicking "Join now"');
        const joinBtn = page.locator('button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")').first();
        await joinBtn.click({ timeout: 10000 });
        
        await page.waitForTimeout(2000);
        if (await joinBtn.isVisible()) {
             console.log('[DEBUG] Join button still visible, trying Enter key...');
             await joinBtn.focus();
             await page.keyboard.press('Enter');
        }
'''
text = text.replace('        console.log(\'[DEBUG] Clicking "Join now"\');\n        const joinBtn = page.locator(\'button[data-tid="prejoin-join-button"], button[data-tid="join-button"], button:has-text("Join now")\').first();\n        await joinBtn.click({ timeout: 10000 });', replacement.strip('\n'))

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
