import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

old_timer = """const hasTimer = /\d{2}:\d{2}/.test(text);"""
new_timer = """const hasTimer = /(?:\d{2}:\d{2}|--:--)/.test(text);"""

code = code.replace(old_timer, new_timer)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Applied timer fix!")
