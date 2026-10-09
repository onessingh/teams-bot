with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

# Replace PiP expand logic block
old_block = """    // Expand the meeting from PiP mini-window to full view
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
                const pip = document.querySelector('[data-tid="calls-pip"], .calls-pip, [class*="pipContainer"]');
                if (pip) {
                    // Dispatch a true mousedown event as React sometimes ignores .click()
                    pip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    pip.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    pip.click();
                    return 'pip container dispatched mousedown/click';
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
        
        // ULTIMATE FALLBACK: Blind click the top-left area where the PiP window floats
        // This physically clicks the center of the PiP to expand it if DOM locators failed
        console.log('[DEBUG] Blind clicking top-left area (150, 150) to force PiP expansion...');
        await page.mouse.click(150, 150);
        await page.waitForTimeout(1000);
        await page.mouse.click(200, 200);
        await page.waitForTimeout(1000);
        
    } catch(e) { console.log('[DEBUG] PiP expand error:', e.message); }"""

new_block = """    // Expand the meeting from PiP mini-window to full view
    try {
        console.log('[DEBUG] Expanding meeting from PiP / full view...');
        
        let expandedMeeting = false;
        for (let attempt = 0; attempt < 5; attempt++) {
            const result = await page.evaluate(() => {
                // 1. Look ONLY inside PiP container or specific call buttons
                const pipContainer = document.querySelector('[data-tid="calls-pip"], [class*="pipContainer"], [class*="pipWindow"], [data-tid="calling-status-bar"]');
                if (pipContainer) {
                    const pipBtns = Array.from(pipContainer.querySelectorAll('button, div[role="button"]'));
                    if (pipBtns.length > 0) {
                        // Click the last button in PiP header (usually expand ?) or first matching expand
                        const expandBtn = pipBtns.find(b => {
                            const l = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
                            return l.includes('full') || l.includes('pop') || l.includes('expand') || l.includes('return') || l.includes('maximize');
                        }) || pipBtns[pipBtns.length - 1];
                        
                        expandBtn.click();
                        return 'pip button clicked: ' + (expandBtn.getAttribute('aria-label') || expandBtn.title || 'icon');
                    }
                    
                    pipContainer.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    pipContainer.click();
                    return 'pip container clicked directly';
                }

                // 2. Global search for call popout/expand buttons (STRICT: EXCLUDE SEARCH / SIDEBAR)
                const expandBtns = Array.from(document.querySelectorAll('button, div[role="button"]')).filter(b => {
                    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || b.textContent || '').toLowerCase();
                    if (label.includes('search') || label.includes('app bar') || label.includes('profile') || label.includes('activity')) return false;
                    return label.includes('open call in full') || 
                           label.includes('pop out') || 
                           label.includes('popout') ||
                           label.includes('full view') ||
                           label.includes('back to call') ||
                           label.includes('return to meeting');
                });
                if (expandBtns.length > 0) {
                    expandBtns[0].click();
                    return 'global expand button clicked: ' + (expandBtns[0].getAttribute('aria-label') || expandBtns[0].title || '?');
                }
                
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
        
        // If DOM search failed, blind-click the CENTER of the floating PiP window (x: 350, y: 200)
        if (!expandedMeeting) {
            console.log('[DEBUG] DOM expand failed. Blind clicking center of PiP window (350, 200)...');
            await page.mouse.click(350, 200);
            await page.waitForTimeout(1500);
        }

        // Close All contacts if opened
        await page.waitForTimeout(1000);
        const bodyText = await page.evaluate(() => document.body.innerText || '');
        if (bodyText.toLowerCase().includes('all contacts')) {
            console.log('[DEBUG] All Contacts still showing - pressing Escape...');
            await page.keyboard.press('Escape');
            await page.waitForTimeout(1500);
        }
    } catch(e) { console.log('[DEBUG] PiP expand error:', e.message); }"""

if old_block in code:
    code = code.replace(old_block, new_block)
    with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Successfully patched PiP expand logic!")
else:
    print("ERR: old_block not found in live-recorder.js!")
