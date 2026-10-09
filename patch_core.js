const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

const oldLobbyChunk = `
        let admitted = false;
        let initLobbyWaitLoops = 0;
        
        while (!admitted && initLobbyWaitLoops < 120) { 
          // Wait in lobby (up to 30 mins)
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
          
          if (isAdmitted) {
              admitted = true;
              break;
          }
`;

const newLobbyChunk = `
        let admitted = false;
        let initLobbyWaitLoops = 0;
        
        while (!admitted && initLobbyWaitLoops < 120) { 
          // Wait in lobby (up to 30 mins)
          const isAdmitted = await page.evaluate(() => {
              // Only consider admitted if we can actually see the video gallery OR the text clearly says you are the only one here
              const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
              const text = document.body.innerText.toLowerCase();
              
              // We must explicitly NOT have lobby text
              const inLobby = text.includes('waiting in the lobby') || 
                              text.includes('we\\'ve let people') ||
                              text.includes('we\\'ll let people') ||
                              text.includes('when the meeting starts');
                              
              if (inLobby) return false;
              
              // If video gallery is there, we are 100% in.
              if (hasVideoGallery) return true;
              
              // If no lobby text, check if core buttons are visible (not just in DOM but actually visible dimensions)
              const muteBtn = document.querySelector('[data-tid="toggle-mute"]');
              if (muteBtn && muteBtn.getBoundingClientRect().width > 0) return true;
              
              return false;
          });
          
          if (isAdmitted) {
              admitted = true;
              break;
          }
`;

code = code.replace(oldLobbyChunk, newLobbyChunk);

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
             console.log('[DEBUG] Mic button not found on screen.');
        }
    } catch(e) {}
`;

const newMicChunk = `
    // Double check mic is muted inside the meeting
    try {
        console.log('[DEBUG] Checking mic status unconditionally via brute force...');
        // We will blind fire Ctrl+Shift+M immediately just in case, wait, 
        // In Teams, the toggle button could be 'Mute' or 'Unmute'.
        // Let's just look at aria-label.
        
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute" i], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaLabel = (await inMeetingMic.getAttribute('aria-label')) || '';
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            
            // "Mute" action means it's currently unmuted.
            // aria-checked="false" on a mute toggle means it's not muted.
            const isUnmuted = ariaChecked === 'false' || ariaLabel.toLowerCase().startsWith('mute');
            console.log('[DEBUG] Mic unmuted status:', isUnmuted, ' (label:', ariaLabel, 'checked:', ariaChecked, ')');
            
            if (isUnmuted) {
                console.log('[DEBUG] Clicking mic to mute it...');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(2000);
            } else {
                console.log('[DEBUG] Mic appears already muted.');
            }
        }
    } catch(e) {}
`;

code = code.replace(oldMicChunk, newMicChunk);
fs.writeFileSync('bot/live-recorder.js', code, 'utf8');
console.log('Fixed lobby and mic');
