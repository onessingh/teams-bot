import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("'-vf', 'crop=1280:720:0:85',", "'-vf', 'crop=892:628:68:176',")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
