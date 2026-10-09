with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_ui = r'''      // Hide UI
      try \{
        await page\.keyboard\.press\('F11'\);
        await page\.evaluate\(\(\) => \{
          const style = document\.createElement\('style'\);
          style\.innerHTML = 
            \* \{ cursor: none !important; \}
            /\* Hide top bar \*/
            \[data-tid="app-layout-header"\], \[role="banner"\] \{ display: none !important; \}
            /\* Hide left bar \*/
            \[data-tid="app-layout-app-bar"\], nav\[role="navigation"\] \{ display: none !important; \}
            /\* Hide meeting controls \*/
            \[role="toolbar"\], \[data-tid="calling-unified-controls"\], \.fui-Toolbar, \[data-tid="call-controls-toolbar"\] \{ opacity: 0 !important; pointer-events: none !important; \}
            /\* Push the main video stage to fill the entire browser! \*/
            \[data-tid="app-layout-area--center"\], \[role="main"\] \{
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 99999 !important;
                background: #000 !important;
                padding: 0 !important;
                margin: 0 !important;
            \}
            /\* Hide the right pane visually by pushing it behind the video \*/
            \[data-tid="side-panel"\], \[role="complementary"\], aside \{
                z-index: 1 !important;
                opacity: 0\.01 !important;
            \}
          ;
          document\.head\.appendChild\(style\);
        \}\);
      \} catch\(e\) \{\}'''

new_ui = '''      // Hide UI
      try {
        await page.keyboard.press('F11');
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.innerHTML = * { cursor: none !important; };
          document.head.appendChild(style);

          // Active Geometric UI Hider (runs every 2 seconds to catch React re-renders)
          setInterval(() => {
              try {
                  // 1. Hide Top Header (using the Search bar as an anchor)
                  const searchInput = document.querySelector('input[placeholder*="Ctrl+Alt+G"], input[placeholder*="Type "], input[id*="search"]');
                  if (searchInput) {
                      let parent = searchInput.parentElement;
                      for(let i = 0; i < 10; i++) {
                          if (parent && parent.tagName !== 'BODY') {
                              const r = parent.getBoundingClientRect();
                              if (r.height < 100 && r.width > window.innerWidth * 0.5 && r.top <= 0) {
                                  parent.style.setProperty('display', 'none', 'important');
                                  break;
                              }
                              parent = parent.parentElement;
                          }
                      }
                  }

                  // 2. Hide Left App Bar (using the Activity button as an anchor)
                  const activityBtn = document.querySelector('button[aria-label="Activity"], button[name="Activity"]');
                  if (activityBtn) {
                      let parent = activityBtn.parentElement;
                      for(let i = 0; i < 12; i++) {
                          if (parent && parent.tagName !== 'BODY') {
                              const r = parent.getBoundingClientRect();
                              if (r.width < 100 && r.height > window.innerHeight * 0.5 && r.left <= 0) {
                                  parent.style.setProperty('display', 'none', 'important');
                                  break;
                              }
                              parent = parent.parentElement;
                          }
                      }
                  }

                  // 3. Hide Meeting Controls (using the View/Raise/React buttons as an anchor)
                  const peopleBtn = document.querySelector('button[aria-label="People"], button[aria-label="Raise"], button[aria-label="View"], button[aria-label="React"]');
                  if (peopleBtn) {
                      let toolbar = peopleBtn.parentElement;
                      for (let i = 0; i < 8; i++) {
                          if (toolbar && toolbar.tagName !== 'BODY') {
                              const r = toolbar.getBoundingClientRect();
                              if (r.width > 200 && r.height < 120) {
                                  toolbar.style.setProperty('opacity', '0', 'important');
                                  toolbar.style.setProperty('pointer-events', 'none', 'important');
                                  break;
                              }
                              toolbar = toolbar.parentElement;
                          }
                      }
                  }

                  // 4. Hide Participants Pane visually (but keep text readable)
                  const shareBtn = document.querySelector('button[aria-label*="Share invite"], input[placeholder*="Type a name"]');
                  if (shareBtn) {
                      let pane = shareBtn.parentElement;
                      for (let i = 0; i < 10; i++) {
                          if (pane && pane.tagName !== 'BODY') {
                              const r = pane.getBoundingClientRect();
                              if (r.width >= 200 && r.width <= 500 && r.height > window.innerHeight * 0.5) {
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

                  // 5. Force the main video stage to fill screen
                  const video = document.querySelector('video');
                  if (video) {
                      let stage = video.parentElement;
                      // Walk up until we find a large container
                      for (let i = 0; i < 10; i++) {
                          if (stage && stage.tagName !== 'BODY') {
                              const r = stage.getBoundingClientRect();
                              if (r.width > window.innerWidth * 0.4 && r.height > window.innerHeight * 0.4) {
                                  stage.style.setProperty('position', 'fixed', 'important');
                                  stage.style.setProperty('top', '0', 'important');
                                  stage.style.setProperty('left', '0', 'important');
                                  stage.style.setProperty('width', '100vw', 'important');
                                  stage.style.setProperty('height', '100vh', 'important');
                                  stage.style.setProperty('z-index', '999', 'important');
                                  stage.style.setProperty('background', '#000', 'important');
                                  stage.style.setProperty('padding', '0', 'important');
                                  stage.style.setProperty('margin', '0', 'important');
                                  // Don't break, keep applying to parent if it's also large, or just break here.
                                  // The first large wrapper is usually the grid container.
                                  break; 
                              }
                              stage = stage.parentElement;
                          }
                      }
                  }

              } catch (err) {}
          }, 2000);
        });
      } catch(e) {}'''

text = re.sub(old_ui, new_ui, text, flags=re.DOTALL)
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
