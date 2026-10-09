const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

const oldPrejoin = `
        // Ensure mic is muted
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

const newPrejoin = `
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

code = code.replace(oldPrejoin.trim(), newPrejoin.trim());

const oldLobby = `
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

const newLobby = `
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
            
            // ONLY rely on video gallery. DO NOT RELY ON MUTE BUTTON because it exists in the new Teams lobby!
            if (hasVideoGallery) return true;
            
            return false;
        });
        
        if (isAdmitted) {
            admitted = true;
            break;
        }
`;

code = code.replace(oldLobby.trim(), newLobby.trim());

const oldInMeeting = `
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

const newInMeeting = `
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

code = code.replace(oldInMeeting.trim(), newInMeeting.trim());

// Add console forwarding
code = code.replace(`const MAX_RETRIES = 3;`, `
    page.on('console', msg => {
        if (msg.text().startsWith('[DEBUG-DUMP]')) console.log(msg.text());
    });
    const MAX_RETRIES = 3;
`);

fs.writeFileSync('bot/live-recorder.js', code, 'utf8');
console.log('Safe patch applied');
