with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_pip = """        let expandedMeeting = false;
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
        }"""

new_pip = """        let expandedMeeting = false;
        for (let attempt = 0; attempt < 5; attempt++) {
            const result = await page.evaluate(() => {
                // Find floating PiP window by checking elements that contain call timer (e.g. 00:47) or meeting title
                const allElements = Array.from(document.querySelectorAll('div, section, iframe'));
                const pipCandidates = allElements.filter(el => {
                    const rect = el.getBoundingClientRect();
                    // Floating window size: width between 150px and 500px, height between 100px and 400px
                    if (rect.width >= 150 && rect.width <= 550 && rect.height >= 100 && rect.height <= 450) {
                        const style = window.getComputedStyle(el);
                        if (style.position === 'absolute' || style.position === 'fixed' || style.zIndex > 10) {
                            return true;
                        }
                    }
                    return false;
                });

                console.log('[DEBUG-DUMP] Found PiP candidates count:', pipCandidates.length);

                for (const candidate of pipCandidates) {
                    // Try clicking any button inside candidate with expand/popout/full aria-label, OR the top-right button
                    const btns = Array.from(candidate.querySelectorAll('button, [role="button"]'));
                    for (const btn of btns) {
                        const aria = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
                        if (aria.includes('expand') || aria.includes('pop') || aria.includes('full') || aria.includes('return') || aria.includes('maximize')) {
                            btn.click();
                            return 'clicked matching button inside pip: ' + aria;
                        }
                    }
                    if (btns.length > 0) {
                        // In Teams PiP header, the expand/popout button is usually the 1st or last button before close
                        btns[0].click();
                        return 'clicked first button in pip candidate';
                    }
                    // Click top area of candidate
                    candidate.click();
                    return 'clicked candidate div directly';
                }

                // Global search for any button with popout/expand aria-label (excluding search bar)
                const globalBtns = Array.from(document.querySelectorAll('button, [role="button"]')).filter(b => {
                    const label = (b.getAttribute('aria-label') || b.getAttribute('title') || '').toLowerCase();
                    if (label.includes('search') || label.includes('app bar') || label.includes('profile')) return false;
                    return label.includes('pop out') || label.includes('open call in full') || label.includes('return to meeting');
                });
                if (globalBtns.length > 0) {
                    globalBtns[0].click();
                    return 'clicked global popout button: ' + globalBtns[0].getAttribute('aria-label');
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
        
        // If DOM search failed, blind-click both the PiP Title Bar (150, 95) and the Expand Icon (310, 95)
        if (!expandedMeeting) {
            console.log('[DEBUG] DOM expand failed. Blind clicking PiP title bar (150, 95) & expand icon (310, 95)...');
            await page.mouse.click(150, 95);
            await page.waitForTimeout(1000);
            await page.mouse.click(310, 95);
            await page.waitForTimeout(1500);
        }"""

if old_pip in code:
    code = code.replace(old_pip, new_pip)
    with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Successfully updated PiP detection with bounding rect floating window finder & title bar coordinates!")
else:
    print("ERR: old_pip not found in live-recorder.js!")
