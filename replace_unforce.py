with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace('await joinBtn.click({ timeout: 10000, force: true });', 'await joinBtn.click({ timeout: 10000 });')
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
