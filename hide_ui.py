with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_ui = r'''      // Hide UI
      try \{
        await page\.keyboard\.press\('F11'\);
        await page\.evaluate\(\(\) => \{
          const style = document\.createElement\('style'\);
          style\.innerHTML = '\* \{ cursor: none !important; \} \.fui-Toolbar, \[data-tid="call-controls-toolbar"\], \.ts-calling-screen-header \{ opacity: 0 !important; display: none !important; pointer-events: none !important; \}';
          document\.head\.appendChild\(style\);
        \}\);
      \} catch\(e\) \{\}'''

new_ui = '''      // Hide UI
      try {
        await page.keyboard.press('F11');
        await page.evaluate(() => {
          const style = document.createElement('style');
          style.innerHTML = 
            * { cursor: none !important; }
            /* Hide top bar */
            [data-tid="app-layout-header"], [role="banner"] { display: none !important; }
            /* Hide left bar */
            [data-tid="app-layout-app-bar"], nav[role="navigation"] { display: none !important; }
            /* Hide meeting controls */
            [role="toolbar"], [data-tid="calling-unified-controls"], .fui-Toolbar, [data-tid="call-controls-toolbar"] { opacity: 0 !important; pointer-events: none !important; }
            /* Push the main video stage to fill the entire browser! */
            [data-tid="app-layout-area--center"], [role="main"] {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                width: 100vw !important;
                height: 100vh !important;
                z-index: 99999 !important;
                background: #000 !important;
                padding: 0 !important;
                margin: 0 !important;
            }
            /* Hide the right pane visually by pushing it behind the video */
            [data-tid="side-panel"], [role="complementary"], aside {
                z-index: 1 !important;
                opacity: 0.01 !important;
            }
          ;
          document.head.appendChild(style);
        });
      } catch(e) {}'''

text = re.sub(old_ui, new_ui, text, flags=re.DOTALL)
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
