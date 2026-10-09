import re

with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('maxMs: item.maxMs || MAX_MS,', 'maxMs: item.maxMs || MAX_MS,\n      scheduledTime: item.scheduledTime || 0,')

with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(text)
