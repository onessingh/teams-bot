import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('let isNativeFullScreen = false;\n', '')
text = text.replace('let ffmpeg = null;', 'let ffmpeg = null;\n    let isNativeFullScreen = false;')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
