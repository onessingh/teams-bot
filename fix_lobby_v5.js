const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

const fixLobby = `
          const isAdmitted = await page.evaluate(() => {
              const text = document.body.innerText.toLowerCase();
              const inLobby = text.includes('waiting for others to join') || 
                              text.includes('when the meeting starts') ||
                              text.includes('we\\'ll let people know you\\'re waiting') ||
                              text.includes('waiting in the lobby') ||
                              text.includes('someone in the meeting should let you in soon');
                              
              if (inLobby) return false;
              
              return !!document.querySelector('[data-tid="leave-button"], [data-tid="call-hangup"], button[aria-label*="Leave" i], [data-tid="toggle-mute"]');
          });
`;

content = content.replace(/const isAdmitted = await page\.evaluate\(\(\) => \{[\s\S]*?return score >= 2;\s*\}\);/, fixLobby);

const fixMic = `
    try {
        console.log('[DEBUG] Checking mic status...');
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = (await inMeetingMic.getAttribute('aria-label')) || '';
            
            const isUnmuted = ariaChecked === 'false' || ariaLabel.toLowerCase().startsWith('mute');
            
            console.log('[DEBUG] Mic unmuted status:', isUnmuted, '(aria-checked:', ariaChecked, ', aria-label:', ariaLabel, ')');
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now via click!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
                
                const checkAria = await inMeetingMic.getAttribute('aria-checked');
                console.log('[DEBUG] Mic status after click is now (aria-checked):', checkAria);
            } else {
                console.log('[DEBUG] Mic is already muted.');
            }
        } else {
             console.log('[DEBUG] Mic button not found on screen.');
             await page.keyboard.press('Control+Shift+M');
        }
    } catch(e) {
        console.log('[DEBUG] Mic verify error:', e.message);
    }
`;

content = content.replace(/try \{[\s\S]*?console\.log\('\[DEBUG\] Mic status after click is now:', checkAria\);\s*\}/, fixMic);

fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
