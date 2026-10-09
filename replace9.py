import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('      const recentCounts = [];\n    const recentCounts = [];', '      const recentCounts = [];')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
