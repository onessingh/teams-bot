const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8').replace(/\r\n/g, '\n');

// 1. Prejoin Mic
const s1 = `        // Ensure mic is muted`;
const idx1 = code.indexOf(s1);
const s2 = `        } catch(e) {
            console.log('[DEBUG] Mic toggle error on prejoin', e.message);
        }`;
const idx2 = code.indexOf(s2) + s2.length;
if (idx1 > -1 && idx2 > idx1 && idx2 < idx1 + 2000) {
    code = code.substring(0, idx1) + `        // Ensure mic is muted
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
        }` + code.substring(idx2);
} else { console.log('Failed prejoin'); }

// 2. Lobby
const s3 = `      while (!admitted && initLobbyWaitLoops < 120) {`;
const idx3 = code.indexOf(s3);
const s4 = `        if (isAdmitted) {
            admitted = true;
            break;
        }`;
const idx4 = code.indexOf(s4, idx3) + s4.length;
if (idx3 > -1 && idx4 > idx3 && idx4 < idx3 + 2000) {
    code = code.substring(0, idx3) + `      while (!admitted && initLobbyWaitLoops < 120) { 
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
        }` + code.substring(idx4);
} else { console.log('Failed lobby'); }

// 3. In-Meeting Mic
const s5 = `    // Double check mic is muted inside the meeting`;
const idx5 = code.indexOf(s5);
const s6_real = `      } catch(e) {
          console.log('[DEBUG] Mic verify error:', e.message);
      }`;
const idx6 = code.indexOf(s6_real, idx5) + s6_real.length;

if (idx5 > -1 && idx6 > idx5 && idx6 < idx5 + 2000) {
    code = code.substring(0, idx5) + `    // Double check mic is muted inside the meeting
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
    } catch(e) { console.log('[DEBUG] Mic verify error:', e.message); }` + code.substring(idx6);
} else { console.log('Failed in-meeting'); }

fs.writeFileSync('bot/live-recorder.js', code, 'utf8');
console.log('Fixed correctly with \\n!');
