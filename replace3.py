import re
with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Change loopCount > 40 to loopCount > 20 (Wait 5 minutes instead of 10)
# Change 0.25 to 0.60 (Trigger if 40% of people leave)
text = text.replace('if (loopCount > 40 && maxParticipants > 5) {', 'if (loopCount > 20 && maxParticipants > 5) {')
text = text.replace('if (currentCount <= Math.ceil(maxParticipants * 0.25)) {', 'if (currentCount <= Math.ceil(maxParticipants * 0.60)) {')

# For small meetings, also reduce wait time to 5 mins
text = text.replace('if (loopCount > 40 && maxParticipants > 1 && maxParticipants <= 5) {', 'if (loopCount > 20 && maxParticipants > 1 && maxParticipants <= 5) {')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
