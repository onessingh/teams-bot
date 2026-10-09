import sys
import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Prejoin Mic
code = re.sub(
    r"        // Ensure mic is muted.*?console\.log\('\[DEBUG\] Mic toggle error on prejoin', e\.message\);\s*\}",
    """        // Ensure mic is muted
        try {
            console.log('[DEBUG] Checking if Mic is ON on prejoin...');
            const isMicOn = await page.evaluate(() => {
                const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                    (el.getAttribute('data-tid') === 'toggle-mute') ||
                    (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('mic'))
                );
                micBtns.forEach(b => console.log('[DEBUG-DUMP] Prejoin Mic:', b.outerHTML));
                for (let btn of micBtns) {
                    const ariaChecked = btn.getAttribute('aria-checked');
                    const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                    const dataState = btn.getAttribute('data-state');
                    if (ariaChecked === 'false' || dataState === 'unmuted' || ariaLabel === 'mute' || ariaLabel === 'mute microphone') return true;
                }
                return false;
            });
            if (isMicOn) {
                console.log('[DEBUG] Clicking mic on prejoin to mute...');
                await page.evaluate(() => {
                    const btn = document.querySelector('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]');
                    if (btn) btn.click();
                });
                await page.waitForTimeout(1000);
            }
        } catch(e) {
            console.log('[DEBUG] Mic toggle error on prejoin', e.message);
        }""",
    code,
    flags=re.DOTALL
)

# 2. Lobby
code = re.sub(
    r"      while \(initLobbyWaitLoops < 120\) \{.*?admitted = true;\s*break;\s*\}",
    """      while (initLobbyWaitLoops < 120) { 
        // Wait in lobby (up to 30 mins)
        const isAdmitted = await page.evaluate(() => {
            const text = document.body.innerText || '';
            console.log('[DEBUG-DUMP] Lobby screen text:', text.replace(/\\n/g, ' | '));
            
            const lowerText = text.toLowerCase();
            const inLobby = lowerText.includes('waiting in the lobby') || 
                            lowerText.includes('we\\'ve let people') ||
                            lowerText.includes('we\\'ll let people') ||
                            lowerText.includes('when the meeting starts') ||
                            lowerText.includes('waiting for others to join') ||
                            lowerText.includes('someone in the meeting should let you in soon');
                            
            if (inLobby) return false;
            
            const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
            if (hasVideoGallery) return true;
            
            return false;
        });
        
        if (isAdmitted) {
            admitted = true;
            break;
        }""",
    code,
    flags=re.DOTALL
)

# 3. In meeting
code = re.sub(
    r"    // Double check mic is muted inside the meeting.*?console\.log\('\[DEBUG\] Mic verify error:', e\.message\);\s*\}",
    """    // Double check mic is muted inside the meeting
    try {
        console.log('[DEBUG] Checking mic status inside meeting...');
        await page.evaluate(() => {
            const btns = document.querySelectorAll('[data-tid="toggle-mute"], button[aria-label*="Mute" i], button[aria-label*="mic" i]');
            btns.forEach(btn => console.log('[DEBUG-DUMP] In-meeting Mic Btn:', btn.outerHTML));
        });
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute" i], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaLabel = (await inMeetingMic.getAttribute('aria-label')) || '';
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const dataState = await inMeetingMic.getAttribute('data-state');
            const isUnmuted = ariaChecked === 'false' || dataState === 'unmuted' || ariaLabel.toLowerCase() === 'mute' || ariaLabel.toLowerCase() === 'mute microphone';
            console.log('[DEBUG] Mic unmuted status:', isUnmuted, ' (label:', ariaLabel, 'checked:', ariaChecked, 'state:', dataState, ')');
            if (isUnmuted) {
                console.log('[DEBUG] Clicking mic to mute it...');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
            }
        }
    } catch(e) { console.log('[DEBUG] Mic verify error:', e.message); }""",
    code,
    flags=re.DOTALL
)

code = code.replace("const MAX_RETRIES = 3;", "page.on('console', msg => { if (msg.text().startsWith('[DEBUG-DUMP]')) console.log(msg.text()); });\n      const MAX_RETRIES = 3;")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Python regex patch applied!")
