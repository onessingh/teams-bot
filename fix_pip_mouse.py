import re

with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_code = """                // 2. Try the PiP container itself
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
                }"""

new_code = """                // 2. Try the PiP container itself
                const pip = document.querySelector('[data-tid="calls-pip"], .calls-pip, [class*="pipContainer"]');
                if (pip) {
                    // Dispatch a true mousedown event as React sometimes ignores .click()
                    pip.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
                    pip.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
                    pip.click();
                    return 'pip container dispatched mousedown/click';
                }"""

code = code.replace(old_code, new_code)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Updated PiP DOM click to use mousedown dispatch.")
