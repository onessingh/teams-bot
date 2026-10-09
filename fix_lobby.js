const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// The current lobby admit check:
// const chatBtn = document.querySelector('[data-tid="chat-button"], [aria-label*="Chat" i]');
// This is faulty because Teams pre-renders the top bar behind the lobby modal.
// We should check if the lobby modal itself has disappeared AND meeting controls exist,
// OR we check for the central meeting stage element.

const newLobbyCheck = `
            // Check if we are truly in the meeting. 
            // We must NOT be in the lobby. The lobby has text like "Waiting for others to join" or "Someone in the meeting should let you in soon"
            const lobbyTextPresent = Array.from(document.querySelectorAll('div, span, h2, h1')).some(el => {
                const txt = (el.innerText || '').toLowerCase();
                return txt.includes('waiting for others to join') || txt.includes('should let you in soon') || txt.includes('when the meeting starts, we') || txt.includes('we\\'ll let people know you\\'re waiting');
            });
            
            // Check for buttons that only exist inside a real meeting
            const chatBtn = document.querySelector('[data-tid="chat-button"], [aria-label*="Chat" i]');
            const peopleBtn = document.querySelector('[data-tid="roster-button"], [aria-label*="People" i]');
            const leaveBtn = document.querySelector('[data-tid="leave-button"], [data-tid="call-hangup"]');
            
            // We are admitted IF there's no lobby text AND meeting buttons exist
            return !lobbyTextPresent && !!(chatBtn || peopleBtn || leaveBtn);
`;

const oldLobbyCheck = `
            // Check for buttons that only exist inside a real meeting (not in lobby)
            const chatBtn = document.querySelector('[data-tid="chat-button"], [aria-label*="Chat" i]');
            const peopleBtn = document.querySelector('[data-tid="roster-button"], [aria-label*="People" i]');
            const reactBtn = document.querySelector('[data-tid="reactions-button"], [aria-label*="React" i]');
            const shareBtn = document.querySelector('[data-tid="share-button"], [aria-label*="Share" i]');
            return !!(chatBtn || peopleBtn || reactBtn || shareBtn);
`;

content = content.replace(oldLobbyCheck, newLobbyCheck);

// Let's also make sure we force-mute continuously in the first 30 seconds of meeting just in case
// Find the "Double check mic is muted inside the meeting" block
const micCheck = `
    // Double check mic is muted inside the meeting
    try {
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = await inMeetingMic.getAttribute('aria-label');
            const isUnmuted = ariaChecked === 'true' || (ariaLabel && ariaLabel.toLowerCase().includes('mute') && !ariaLabel.toLowerCase().includes('unmute'));
            
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now!');
                await inMeetingMic.click({ force: true });
                await page.waitForTimeout(1000);
            }
        }
    } catch(e) {
        console.log('[DEBUG] Could not verify/mute mic inside meeting:', e.message);
    }
`;

// Replace the old mic check which relied on keyboard shortcut which failed in PiP
const oldMicBlock = `
    // Double check mic is muted inside the meeting
    try {
        const inMeetingMic = page.locator('[data-tid="toggle-mute"], button[aria-label*="Mute"], button[aria-label*="mic" i]').first();
        if (await inMeetingMic.isVisible({ timeout: 5000 })) {
            const ariaChecked = await inMeetingMic.getAttribute('aria-checked');
            const ariaLabel = await inMeetingMic.getAttribute('aria-label');
            const isUnmuted = ariaChecked === 'true' || (ariaLabel && ariaLabel.toLowerCase().includes('mute') && !ariaLabel.toLowerCase().includes('unmute'));
            
            if (isUnmuted) {
                console.log('[DEBUG] Mic was left ON in meeting, turning it OFF now!');
                // Try keyboard shortcut first (Ctrl+Shift+M) as it is very reliable
                await page.keyboard.press('Control+Shift+M');
                await page.waitForTimeout(1000);
                
                // If still unmuted by checking state, try clicking it
                const stillUnmuted = await inMeetingMic.getAttribute('aria-checked') === 'true';
                if (stillUnmuted) {
                    await inMeetingMic.click();
                    await page.waitForTimeout(1000);
                }
            }
        }
    } catch(e) {
        console.log('[DEBUG] Could not verify/mute mic inside meeting:', e.message);
    }
`;

content = content.replace(oldMicBlock, micCheck);
fs.writeFileSync('bot/live-recorder.js', content);
console.log('Fixed lobby check and mic click');
