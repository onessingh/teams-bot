with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_expand = """        let expandedMeeting = false;
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

new_expand = """        // Check if meeting is already expanded (video stage width > 800)
        let isExpanded = await page.evaluate(() => {
            const v = document.querySelector('video');
            return v && v.getBoundingClientRect().width > 800;
        });

        if (!isExpanded) {
            console.log('[DEBUG] Meeting is in PiP mode. Attempting to expand...');
            
            // 1. Try DOM expand buttons first
            await page.evaluate(() => {
                const btns = Array.from(document.querySelectorAll('button, [role="button"]'));
                for (const btn of btns) {
                    const label = (btn.getAttribute('aria-label') || btn.getAttribute('title') || '').toLowerCase();
                    if (label.includes('search') || label.includes('app bar') || label.includes('profile')) continue;
                    if (label.includes('open call in full') || label.includes('pop out') || label.includes('return to meeting')) {
                        btn.click();
                    }
                }
            });
            await page.waitForTimeout(1500);

            // 2. Physical mouse clicks on PiP title bar (x: 200, y: 95) and expand icon (x: 320, y: 95)
            console.log('[DEBUG] Physical mouse click on PiP header title bar (200, 95)...');
            await page.mouse.click(200, 95);
            await page.waitForTimeout(1500);

            console.log('[DEBUG] Physical mouse click on PiP expand icon (320, 95)...');
            await page.mouse.click(320, 95);
            await page.waitForTimeout(1500);
            
            // Check expansion status again
            isExpanded = await page.evaluate(() => {
                const v = document.querySelector('video');
                return v && v.getBoundingClientRect().width > 800;
            });
            console.log('[DEBUG] Meeting expansion status after clicks:', isExpanded);
        }"""

if old_expand in code:
    code = code.replace(old_expand, new_expand)
    with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Successfully replaced PiP expand with verified physical header click & video width check!")
else:
    print("ERR: old_expand block not found!")
