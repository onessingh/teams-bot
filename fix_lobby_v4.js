const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// The score logic failed because in the lobby (as seen in the screenshot), 
// the Leave, Mic, and Chat buttons are ALL visible in the top bar!
// Teams renders the entire top meeting bar behind the lobby modal.
// This means any querySelector for meeting buttons will return true even in the lobby.

// The ONLY way to know we are in the lobby is the lobby modal itself.
// The lobby modal has an aria-label "Waiting in the lobby" or similar text.
// Let's look for exactly that modal or its text.
const fixLobby = `
          const isAdmitted = await page.evaluate(() => {
              // Teams renders the entire top bar (mic, chat, leave) behind the lobby modal!
              // So we cannot rely on the presence of those buttons.
              // Instead, we MUST rely on the presence of the lobby modal or text.
              
              const text = document.body.innerText.toLowerCase();
              const inLobby = text.includes('waiting for others to join') || 
                              text.includes('when the meeting starts') ||
                              text.includes('we\\'ll let people know you\\'re waiting') ||
                              text.includes('waiting in the lobby') ||
                              text.includes('someone in the meeting should let you in soon');
                              
              // If we see lobby text, we are NOT admitted.
              if (inLobby) return false;
              
              // If we don't see lobby text, verify we see at least one meeting control to be sure the page loaded
              return !!document.querySelector('[data-tid="leave-button"], [data-tid="call-hangup"], button[aria-label*="Leave" i], [data-tid="toggle-mute"]');
          });
`;

content = content.replace(/const isAdmitted = await page\.evaluate\(\(\) => \{[\s\S]*?return score >= 2;\s*\}\);/, fixLobby);

// Let's fix the mic issue.
// Looking at the logs, it said "Mic unmuted status: false". 
// This means the bot thought the mic was ALREADY muted!
// Why?
// In the screenshot, the mic icon has a line through it? Actually, no, the mic icon in the top bar DOES NOT have a line through it.
// Wait, the mic icon in the top bar says "Mic" with a dropdown arrow. The actual mute toggle is the button itself.
// But look at the Participants panel. Next to "Raj Singh", there is a mic icon with a line through it!
// Ah! In the lobby (pre-join), the mic was toggled off. But when admitted, does Teams unmute it? 
// In the screenshot showing the roster, the bot (Raj Singh) is MUTED (mic icon has a slash). 
// SO THE BOT IS ACTUALLY MUTED.
// You are saying the mic is NOT muted?
// If the bot's mic is on, the icon next to Raj Singh would not have a slash.
// Wait, if the mic IS muted, why are you saying it's not muted?
// Let's force click it anyway if it is unmuted, but let's change the detection logic.
// The aria-checked on the toggle-mute button is 'true' if it IS MUTED. Wait, aria-checked="true" means MUTED?
// Yes! For a mute button, pressed (true) means muted!
// My previous code: const isUnmuted = ariaChecked === 'true' ... -> This was wrong! aria-checked="true" means MUTED.
// So if aria-checked="false", it is UNMUTED.

const fixMic = `
    try {
        console.log('[DEBUG] Checking mic status...');
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = (await inMeetingMic.getAttribute('aria-label')) || '';
            
            // aria-checked="true" usually means the button is pressed (Muted).
            // aria-checked="false" means it is not pressed (Unmuted).
            // Alternatively, check the aria-label text. If it says "Mute" (action to take), it is currently unmuted. If it says "Unmute", it is currently muted.
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

content = content.replace(/try \{[\s\S]*?console\.log\('\[DEBUG\] Mic verify error:', e\.message\);\s*\}/, fixMic);

fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
console.log('Fixed Mic and Lobby logic');
