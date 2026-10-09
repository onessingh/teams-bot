import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("crop=1204:605:76:200", "crop=1204:604:76:200")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
