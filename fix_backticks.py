with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('style.innerHTML = \n    * {', 'style.innerHTML = `\n    * {')
text = text.replace('pointer-events: none !important;\n    }\n;', 'pointer-events: none !important;\n    }\n`;')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
