const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// The mic muting logic in the last patch did not properly update because of string replacement mismatch in the powershell script.
// Let's force update the mic click logic and make it super robust using Playwright locator click

const fixMic = `
    // Double check mic is muted inside the meeting
    try {
        console.log('[DEBUG] Checking mic status...');
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = await inMeetingMic.getAttribute('aria-label');
            const isUnmuted = ariaChecked === 'true' || (ariaLabel && ariaLabel.toLowerCase().includes('mute') && !ariaLabel.toLowerCase().includes('unmute'));
            
            console.log('[DEBUG] Mic unmuted status:', isUnmuted);
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now via click!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
            }
        } else {
             console.log('[DEBUG] Mic button not found on screen.');
             await page.keyboard.press('Control+Shift+M');
        }
    } catch(e) {
        console.log('[DEBUG] Mic verify error:', e.message);
    }
`;

// Also, the lobby check failed again because when we are the only one in the meeting or the organizer hasn't started it yet, Teams says "When the meeting starts, we'll let people know you're waiting".
// We need to just check for "When the meeting starts"
const fixLobby = `
          const isAdmitted = await page.evaluate(() => {
              const txt = document.body.innerText.toLowerCase();
              const isLobby = txt.includes('waiting for others to join') || 
                              txt.includes('should let you in soon') || 
                              txt.includes('when the meeting starts') || 
                              txt.includes('let people know you\\'re waiting');
                              
              const hasMeetingControls = !!document.querySelector('[data-tid="chat-button"], [data-tid="roster-button"], [data-tid="leave-button"], [data-tid="call-hangup"]');
              
              return !isLobby && hasMeetingControls;
          });
`;

// We'll replace the block using regex to be safe
content = content.replace(/const isAdmitted = await page\.evaluate\(\(\) => \{[\s\S]*?return !lobbyTextPresent && !!\(chatBtn \|\| peopleBtn \|\| leaveBtn\);\s*\}\);/, fixLobby);

content = content.replace(/\/\/ Double check mic is muted inside the meeting[\s\S]*?\/\/ Open Roster \/ Participants/, fixMic + '\n    // Open Roster / Participants');

fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
console.log('Fixed Mic and Lobby logic');
