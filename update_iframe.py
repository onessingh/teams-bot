with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_block = r'''        // Attempt to clear any Unified Consent or cookie popups.*?console\.log\('\[DEBUG\] Clicking "Join now"'\);'''
new_block = '''        // Attempt to clear any Unified Consent or cookie popups
        try {
            console.log('[DEBUG] Checking for consent iframes...');
            await page.keyboard.press('Escape'); // First try to just escape it
            await page.waitForTimeout(1000);
            
            const consentFrame = page.frameLocator('[data-tid="hosted-content-iframe"]');
            if (await consentFrame.locator('body').isVisible({ timeout: 4000 })) {
                console.log('[DEBUG] Found consent iframe. Waiting for its content to render...');
                await page.waitForTimeout(3000); // give the iframe's React app time to mount
                
                const buttons = consentFrame.locator('button, [role="button"]');
                const count = await buttons.count();
                console.log('[DEBUG] Found ' + count + ' buttons in the iframe.');
                
                if (count > 0) {
                    await buttons.last().click({ timeout: 3000, force: true });
                    console.log('[DEBUG] Clicked the last button in the iframe.');
                } else {
                    console.log('[DEBUG] No buttons found in iframe. Pressing Tab+Enter...');
                    await consentFrame.locator('body').click({ force: true });
                    await page.keyboard.press('Tab');
                    await page.keyboard.press('Enter');
                }
                await page.waitForTimeout(2000);
                
                // If the iframe wrapper is still intercepting, let's aggressively nuke it from the DOM
                console.log('[DEBUG] Nuking the iframe wrapper from the DOM just in case.');
                await page.evaluate(() => {
                    const iframe = document.querySelector('[data-tid="hosted-content-iframe"]');
                    if (iframe) {
                        const wrapper = iframe.closest('div');
                        if (wrapper) {
                            wrapper.style.display = 'none';
                            wrapper.style.pointerEvents = 'none';
                        }
                        iframe.style.display = 'none';
                    }
                });
                await page.waitForTimeout(1000);
            }
        } catch (e) {
            console.log('[DEBUG] Consent iframe handling error or not present:', e.message);
        }

        console.log('[DEBUG] Clicking "Join now"');'''

text = re.sub(old_block, new_block, text, flags=re.DOTALL)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
