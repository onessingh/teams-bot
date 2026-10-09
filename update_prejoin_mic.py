with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_mic = r'''        // Ensure mic is muted
        try \{
            console\.log\('\[DEBUG\] Searching for Mic toggle on prejoin\.\.\.'\);
            await page\.evaluate\(\(\) => \{
                const micBtns = Array\.from\(document\.querySelectorAll\('\*'\)\)\.filter\(el => 
                    \(el\.getAttribute\('data-tid'\) === 'toggle-mute'\) \|\|
                    \(el\.getAttribute\('aria-label'\) && el\.getAttribute\('aria-label'\)\.toLowerCase\(\)\.includes\('microphone'\)\)
                \);
                for \(let btn of micBtns\) \{
                    if \(btn\.getAttribute\('aria-checked'\) === 'true' \|\| btn\.getAttribute\('data-state'\) === 'unmuted'\) \{
                        btn\.click\(\);
                    \}
                \}
            \}\);
            await page\.waitForTimeout\(1000\);
        \} catch\(e\) \{
            console\.log\('\[DEBUG\] Mic toggle error on prejoin', e\.message\);
        \}'''

new_mic = '''        // Ensure mic is muted
        try {
            console.log('[DEBUG] Checking if Mic is ON on prejoin...');
            const isMicOn = await page.evaluate(() => {
                const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    (el.getAttribute('data-tid') === 'toggle-mute') ||
                    (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('microphone'))
                );
                for (let btn of micBtns) {
                    if (btn.getAttribute('aria-checked') === 'true' || btn.getAttribute('data-state') === 'unmuted') {
                        return true;
                    }
                    if (btn.getAttribute('aria-label') && btn.getAttribute('aria-label').toLowerCase().includes('mute') && !btn.getAttribute('aria-label').toLowerCase().includes('unmute')) {
                        return true; // it says "Mute microphone", meaning it is unmuted
                    }
                }
                return false;
            });
            
            if (isMicOn) {
                console.log('[DEBUG] Mic is ON! Pressing Ctrl+Shift+M to mute...');
                await page.keyboard.press('Control+Shift+M');
                await page.waitForTimeout(1000);
            }
        } catch(e) {
            console.log('[DEBUG] Mic toggle error on prejoin', e.message);
        }'''

text = re.sub(old_mic, new_mic, text, flags=re.DOTALL)
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
