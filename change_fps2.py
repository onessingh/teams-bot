with open('bot/recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("'-framerate', process.env.RECORDING_FPS || '15',", "'-framerate', process.env.RECORDING_FPS || '30',")

with open('bot/recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
