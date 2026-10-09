import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# The regex will match from "// Hide UI" all the way to "await page.mouse.move(0, 0);"
pattern = r'// Hide UI.*?await page\.mouse\.move\(0, 0\);'

new_code = '''// Hide UI
    try {
      await page.keyboard.press('F11');
      
      const injectHider = async (frame) => {
        try {
          await frame.evaluate(() => {
            const style = document.createElement('style');
            style.innerHTML = * { cursor: none !important; };
            document.head.appendChild(style);

            setInterval(() => {
                try {
                    // Hide Top Header
                    const searchInput = document.querySelector('input[placeholder*="Ctrl+Alt+G"], input[placeholder*="Type"], input[id*="search"]');
                    if (searchInput) {
                        let parent = searchInput.parentElement;
                        for(let i = 0; i < 15; i++) {
                            if (parent && parent.tagName !== 'BODY') {
                                const r = parent.getBoundingClientRect();
                                if (r.height < 120 && r.width > window.innerWidth * 0.4 && r.top <= 0) {
                                    parent.style.setProperty('display', 'none', 'important');
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }

                    // Hide Left App Bar
                    const activityBtn = document.querySelector('button[aria-label="Activity"], button[name="Activity"], button[aria-label="Chat"]');
                    if (activityBtn) {
                        let parent = activityBtn.parentElement;
                        for(let i = 0; i < 15; i++) {
                            if (parent && parent.tagName !== 'BODY') {
                                const r = parent.getBoundingClientRect();
                                if (r.width < 120 && r.height > window.innerHeight * 0.4 && r.left <= 0) {
                                    parent.style.setProperty('display', 'none', 'important');
                                    break;
                                }
                                parent = parent.parentElement;
                            }
                        }
                    }

                    // Hide Meeting Controls
                    const peopleBtn = document.querySelector('button[aria-label="People"], button[aria-label="Raise"], button[aria-label="View"], button[aria-label="React"]');
                    if (peopleBtn) {
                        let toolbar = peopleBtn.parentElement;
                        for (let i = 0; i < 12; i++) {
                            if (toolbar && toolbar.tagName !== 'BODY') {
                                const r = toolbar.getBoundingClientRect();
                                if (r.width > 200 && r.height < 150) {
                                    toolbar.style.setProperty('opacity', '0', 'important');
                                    toolbar.style.setProperty('pointer-events', 'none', 'important');
                                    break;
                                }
                                toolbar = toolbar.parentElement;
                            }
                        }
                    }

                    // Hide Participants Pane visually
                    const shareBtn = document.querySelector('button[aria-label*="Share invite"], input[placeholder*="Type a name"]');
                    if (shareBtn) {
                        let pane = shareBtn.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (pane && pane.tagName !== 'BODY') {
                                const r = pane.getBoundingClientRect();
                                if (r.width >= 200 && r.width <= 500 && r.height > window.innerHeight * 0.3) {
                                    pane.style.setProperty('opacity', '0.01', 'important');
                                    pane.style.setProperty('position', 'absolute', 'important');
                                    pane.style.setProperty('right', '-9999px', 'important');
                                    pane.style.setProperty('z-index', '-1', 'important');
                                    break;
                                }
                                pane = pane.parentElement;
                            }
                        }
                    }

                    // Force the video stage
                    const video = document.querySelector('video');
                    if (video) {
                        let stage = video.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (stage && stage.tagName !== 'BODY') {
                                const r = stage.getBoundingClientRect();
                                if (r.width > window.innerWidth * 0.3 && r.height > window.innerHeight * 0.3) {
                                    stage.style.setProperty('position', 'fixed', 'important');
                                    stage.style.setProperty('top', '0', 'important');
                                    stage.style.setProperty('left', '0', 'important');
                                    stage.style.setProperty('width', '100vw', 'important');
                                    stage.style.setProperty('height', '100vh', 'important');
                                    stage.style.setProperty('z-index', '999', 'important');
                                    stage.style.setProperty('background', '#000', 'important');
                                    stage.style.setProperty('padding', '0', 'important');
                                    stage.style.setProperty('margin', '0', 'important');
                                    break; 
                                }
                                stage = stage.parentElement;
                            }
                        }
                    }
                } catch (err) {}
            }, 1000);
          });
        } catch(e) {}
      };

      // Inject into main page and all current iframes
      for (const frame of page.frames()) {
          await injectHider(frame);
      }
      
      // Also inject into any newly created iframes dynamically
      page.on('frameattached', async (frame) => {
          await injectHider(frame);
      });

    } catch(e) {}
    await page.mouse.move(0, 0);'''

new_text = re.sub(pattern, new_code, text, flags=re.DOTALL)
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(new_text)
