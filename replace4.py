import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix crop width
text = text.replace("'-vf', 'crop=820:560:76:200',", "'-vf', 'crop=836:560:76:200',")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
