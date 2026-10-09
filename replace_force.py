with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('await joinOnWeb.click();', 'await joinOnWeb.click({ force: true });')
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
