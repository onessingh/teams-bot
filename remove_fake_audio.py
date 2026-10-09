with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("'--use-fake-device-for-media-stream'", "// removed fake device to use pulse fake_mic")
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('bot/recorder.js', 'r', encoding='utf-8') as f:
    text2 = f.read()
text2 = text2.replace("'--use-fake-device-for-media-stream'", "// removed fake device to use pulse fake_mic")
with open('bot/recorder.js', 'w', encoding='utf-8') as f:
    f.write(text2)
