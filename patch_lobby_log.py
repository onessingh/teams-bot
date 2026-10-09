with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('console.log([DEBUG] Lobby timeout reached (10 minutes without being admitted). Ending meeting.);', 'console.log(`[DEBUG] Lobby timeout reached (10 minutes without being admitted). Ending meeting.`);')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
