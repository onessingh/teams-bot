import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add title removal in injectHider
old_btns = '''                    // Aggressively dismiss toasts/popups
                    const btns = document.querySelectorAll('button');'''

new_btns = '''                    // Remove all title attributes to stop hover tooltips
                    document.querySelectorAll('[title]').forEach(el => el.removeAttribute('title'));

                    // Aggressively dismiss toasts/popups
                    const btns = document.querySelectorAll('button');'''
text = text.replace(old_btns, new_btns)

# 2. Change mouse rest position to 0, 800
text = text.replace('await page.mouse.move(0, 0);', 'await page.mouse.move(0, 800);')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
