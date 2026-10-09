import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('const maxMs = options.maxMs || MAX_MS;', 'const maxMs = options.maxMs || MAX_MS;\n  let isNativeFullScreen = false;')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
