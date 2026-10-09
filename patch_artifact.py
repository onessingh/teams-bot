import re

with open('.github/workflows/live-bot.yml', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('path: fallback_video.mp4', 'path: |\n            *.mp4\n            bot/downloads/*.mp4')

with open('.github/workflows/live-bot.yml', 'w', encoding='utf-8') as f:
    f.write(text)
