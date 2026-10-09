import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Add Tooltip CSS
old_css = '''div[data-tid^="banner"], 
    .ui-toast, 
    .toast-container, 
    .ts-toast-stack,'''

new_css = '''div[data-tid^="banner"], 
    .ui-toast, 
    .toast-container, 
    .ts-toast-stack,
    [role="tooltip"],
    .fui-Tooltip,
    .ui-tooltip,'''
text = text.replace(old_css, new_css)

# 2. Add steps to mouse moves to prevent stuck tooltips
text = text.replace('await page.mouse.move(0, 800);', 'await page.mouse.move(0, 800, { steps: 10 });')
text = text.replace('await page.mouse.click(0, 0);', 'await page.mouse.click(0, 500);') # Don't click 0,0, click middle-left edge

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
