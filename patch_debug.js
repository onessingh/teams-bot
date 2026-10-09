const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

const debugPrejoinMic = `
          // Ensure mic is muted
          try {
              console.log('[DEBUG] Checking if Mic is ON on prejoin...');
              const isMicOn = await page.evaluate(() => {
                  const micBtns = Array.from(document.querySelectorAll('*')).filter(el => 
                      (el.getAttribute('data-tid') === 'toggle-mute') ||
                      (el.getAttribute('aria-label') && el.getAttribute('aria-label').toLowerCase().includes('mic'))
                  );
                  // DUMP HTML FOR DEBUGGING
                  micBtns.forEach(btn => console.log('[DEBUG-DUMP] Prejoin Mic Btn:', btn.outerHTML));
                  
                  for (let btn of micBtns) {
                      // Let's just click any mic button that doesn't explicitly say it's already muted.
                      // Usually 'aria-checked'="false" on a mute toggle means it's unmuted.
                      const ariaChecked = btn.getAttribute('aria-checked');
                      const ariaLabel = (btn.getAttribute('aria-label') || '').toLowerCase();
                      const dataState = btn.getAttribute('data-state');
                      
                      if (ariaChecked === 'false' || dataState === 'unmuted' || ariaLabel === 'mute microphone' || ariaLabel === 'mute') {
                          return true;
                      }
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
          }
`;

code = code.replace(/try \{[\s\S]*?console\.log\('\[DEBUG\] Mic toggle error on prejoin', e\.message\);\s*\}/, debugPrejoinMic);

const debugLobby = `
        let admitted = false;
        let initLobbyWaitLoops = 0;
        
        while (!admitted && initLobbyWaitLoops < 120) { 
          // Wait in lobby (up to 30 mins)
          const isAdmitted = await page.evaluate(() => {
              const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
              const text = document.body.innerText;
              
              console.log('[DEBUG-DUMP] Lobby screen text:', text.replace(/\\n/g, ' | '));
              
              const lowerText = text.toLowerCase();
              const inLobby = lowerText.includes('waiting in the lobby') || 
                              lowerText.includes('we\\'ve let people') ||
                              lowerText.includes('we\\'ll let people') ||
                              lowerText.includes('when the meeting starts') ||
                              lowerText.includes('waiting for others to join') ||
                              lowerText.includes('someone in the meeting should let you in soon');
                              
              if (inLobby) return false;
              
              // Only rely on video gallery. DO NOT RELY ON MUTE BUTTON because it exists in the new Teams lobby!
              if (hasVideoGallery) return true;
              
              return false;
          });
          
          if (isAdmitted) {
              admitted = true;
              break;
          }
`;

code = code.replace(/while \(!admitted && initLobbyWaitLoops < 120\) \{[\s\S]*?if \(isAdmitted\) \{[\s\S]*?break;\s*\}/, debugLobby);

const debugInMeetingMic = `
    // Double check mic is muted inside the meeting
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
    } catch(e) {
        console.log('[DEBUG] Mic verify error:', e.message);
    }
`;

code = code.replace(/\/\/ Double check mic is muted inside the meeting[\s\S]*?catch\(e\) \{\}/, debugInMeetingMic);

// Route page console logs to Node console so we can see the DUMPs
const routeConsole = `
      // Route browser console logs to node process for debugging
      page.on('console', msg => {
          if (msg.text().startsWith('[DEBUG-DUMP]')) {
              console.log(msg.text());
          }
      });
      
      const MAX_RETRIES = 3;
`;

code = code.replace(/const MAX_RETRIES = 3;/, routeConsole);

fs.writeFileSync('bot/live-recorder.js', code, 'utf8');
console.log('Added DOM dumping logic');
