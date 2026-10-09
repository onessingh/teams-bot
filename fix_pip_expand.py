with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replace the entire section from "// IMPORTANT: Do NOT click People/Participants" to end of try block
old = """    // IMPORTANT: Do NOT click People/Participants - in new Teams this opens
    // "All contacts" sidebar instead of the in-meeting panel. Count is tracked via text.
    console.log('[DEBUG] Skipping People panel open (causes All Contacts sidebar).');

    // Try to activate "Hide me" and "Full screen" using aggressive locators
    try {
        
    // Step 0a: Click on the meeting mini-window to bring it to focus
    try {
        console.log('[DEBUG] Trying to focus/expand meeting mini-window...');
        const focused = await page.evaluate(() => {
            const pip = document.querySelector('[data-tid="calls-pip"]');
            if (pip) { pip.click(); return 'pip clicked'; }
            const meetingHeader = document.querySelector('[data-tid="calling-status-bar"], [data-tid="meeting-header"]');
            if (meetingHeader) { meetingHeader.click(); return 'header clicked'; }
            const callingDivs = Array.from(document.querySelectorAll('[class*="calling-"][class*="container"], [data-tid*="calling"]'));
            if (callingDivs.length > 0) { callingDivs[0].click(); return 'calling div clicked'; }
            return 'nothing found';
        });
        console.log('[DEBUG] Meeting focus result:', focused);
        await page.waitForTimeout(1500);
    } catch(e) { console.log('[DEBUG] Meeting focus error:', e.message); }

    // Step 0b: Close 'All contacts' sidebar if it's covering the screen
    try {
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts') || bodyText.toLowerCase().includes('find a contact')) {
            console.log('[DEBUG] "All Contacts" sidebar is open - pressing Escape to close...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) {}

    // Step 1: Try to expand PiP if stuck in mini-window
    try {
        console.log('[DEBUG] Checking if stuck in PiP window...');
        await page.evaluate(() => {
            const returnBtns = Array.from(document.querySelectorAll('button')).filter(b => 
                (b.getAttribute('aria-label') || '').toLowerCase().includes('return to meeting') ||
                (b.getAttribute('title') || '').toLowerCase().includes('return to meeting') ||
                (b.getAttribute('aria-label') || '').toLowerCase().includes('back to meeting')
            );
            if (returnBtns.length > 0) {
                returnBtns[0].click();
            } else {
                const miniPlayer = document.querySelector('[data-tid="calls-pip"], .app-svg'); 
                if (miniPlayer) miniPlayer.click();
            }
        });
        await page.waitForTimeout(2000);
    } catch(e) {}"""

new = """    // Expand the meeting from PiP mini-window to full view
    // The meeting goes into PiP after joining - we must expand it
    try {
        console.log('[DEBUG] Expanding meeting from PiP / full view...');
        
        // Try multiple times over 10 seconds
        let expandedMeeting = false;
        for (let attempt = 0; attempt < 5; attempt++) {
            const result = await page.evaluate(() => {
                // 1. Look for the expand/pop-out button on the PiP window (the ? icon)
                const expandBtns = Array.from(document.querySelectorAll('button, div[role="button"]')).filter(b => {
                    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').toLowerCase();
                    return label.includes('open call in full') || 
                           label.includes('pop out') || 
                           label.includes('popout') ||
                           label.includes('expand') ||
                           label.includes('full view') ||
                           label.includes('back to call') ||
                           label.includes('return to') ||
                           label.includes('back to meeting');
                });
                if (expandBtns.length > 0) {
                    expandBtns[0].click();
                    return 'expand button clicked: ' + (expandBtns[0].getAttribute('aria-label') || expandBtns[0].getAttribute('title') || '?');
                }
                
                // 2. Try the PiP container itself
                const pip = document.querySelector('[data-tid="calls-pip"]');
                if (pip) {
                    // Try clicking expand icon inside PiP (usually last button)
                    const pipBtns = pip.querySelectorAll('button');
                    if (pipBtns.length > 0) {
                        pipBtns[pipBtns.length - 1].click(); // last button is usually expand
                        return 'pip last button clicked';
                    }
                    pip.click();
                    return 'pip container clicked';
                }
                
                // 3. Try the calling status bar
                const statusBar = document.querySelector('[data-tid="calling-status-bar"]');
                if (statusBar) { statusBar.click(); return 'status bar clicked'; }
                
                // 4. Dump what we see for debugging
                const allBtns = Array.from(document.querySelectorAll('button')).map(b => b.getAttribute('aria-label') || b.title || b.textContent?.substring(0, 20)).filter(Boolean);
                console.log('[DEBUG-DUMP] All buttons:', JSON.stringify(allBtns.slice(0, 20)));
                return 'nothing found';
            });
            console.log('[DEBUG] Expand attempt', attempt+1, ':', result);
            
            if (!result.includes('nothing found')) {
                expandedMeeting = true;
                await page.waitForTimeout(2000);
                break;
            }
            await page.waitForTimeout(1000);
        }
        
        // After expanding, close All contacts if still open
        await page.waitForTimeout(1000);
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts')) {
            console.log('[DEBUG] All Contacts still showing - pressing Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) { console.log('[DEBUG] PiP expand error:', e.message); }

    // Try to activate "Hide me" and "Full screen" using aggressive locators
    try {"""

code = code.replace(old, new)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Done!")
