import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("'-vf', 'crop=892:628:68:176',", "'-vf', 'crop=820:560:76:200',")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
