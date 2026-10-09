const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// We have the file in 3a3c93c. We just need to fix the lobby detection and mic inverted logic WITHOUT breaking the file.
// Let's use simple string replacement of exactly the chunks we see.

const oldLobbyChunk = `
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

const newLobbyChunk = `
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

content = content.replace(oldLobbyChunk, newLobbyChunk);

const oldMicChunk = `
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
                  // Verify click worked
                  const checkAria = await inMeetingMic.getAttribute('aria-checked');
                  console.log('[DEBUG] Mic status after click is now:', checkAria);
              }
          } else {
              // Just blind fire Ctrl+Shift+M just in case we couldn't find the button but it's on
              console.log('[DEBUG] Mic button not found, blind firing Ctrl+Shift+M to mute...');
              await page.keyboard.press('Control+Shift+M');
          }
      } catch(e) {}
`;

const newMicChunk = `
      // Double check mic is muted inside the meeting
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
              console.log('[DEBUG] Mic button not found on screen, blindly pressing Ctrl+Shift+M...');
              await page.keyboard.press('Control+Shift+M');
          }
      } catch(e) {}
`;

content = content.replace(oldMicChunk, newMicChunk);
fs.writeFileSync('bot/live-recorder.js', content, 'utf8');
console.log('Clean apply success!');
