const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// The issue might be that Teams does not have the meeting control data-tids or they load differently,
// or there's some invisible lobby text staying on the DOM.
// We can use a much simpler logic:
// Inside a meeting, there is ALWAYS a mic mute/unmute button. In the lobby, there is no mute/unmute button.
// AND in the lobby, there is usually an overlay or specific text. Let's rely primarily on the mic button being visible,
// because you can ONLY toggle mic once you're actually in. 
// BUT wait, in the pre-join screen you have a mic button. But we've already passed pre-join.
// In the lobby, there's no mic button. So finding the in-meeting mic button is a very strong indicator of admission.

const fixLobby = `
          const isAdmitted = await page.evaluate(() => {
              // The strongest indicator that we are actually IN the meeting and not in the lobby
              // is the presence of the actual in-meeting mic mute/unmute button or the Leave button.
              // We also make sure we aren't looking at the pre-join screen anymore.
              
              const hasLeaveBtn = !!document.querySelector('[data-tid="leave-button"], [data-tid="call-hangup"], button[aria-label*="Leave" i]');
              const hasMicBtn = !!document.querySelector('[data-tid="toggle-mute"], button[aria-label*="Mute" i], button[aria-label*="mic" i]');
              const hasChatBtn = !!document.querySelector('[data-tid="chat-button"], button[aria-label*="Chat" i]');
              
              // We are admitted if we have at least 2 of the core meeting buttons (to avoid false positives from stray elements)
              const score = (hasLeaveBtn ? 1 : 0) + (hasMicBtn ? 1 : 0) + (hasChatBtn ? 1 : 0);
              return score >= 2;
          });
`;

content = content.replace(/const isAdmitted = await page\.evaluate\(\(\) => \{[\s\S]*?return !isLobby && hasMeetingControls;\s*\}\);/, fixLobby);

// Let's also add an explicit log for mic unmuting so we can see what's happening
const oldMic = `console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now via click!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);`;

const newMic = `console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now via click!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
                // Verify click worked
                const checkAria = await inMeetingMic.getAttribute('aria-checked');
                console.log('[DEBUG] Mic status after click is now:', checkAria);`;

content = content.replace(oldMic, newMic);

fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
console.log('Fixed');
