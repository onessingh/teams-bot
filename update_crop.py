import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace the default parameter in startRecorder
text = text.replace("cropFilter = 'crop=836:560:76:200'", "cropFilter = 'crop=1204:605:76:200'")

# Replace the dynamic crop assignment
old_crop = "const cropF = isNativeFullScreen ? 'crop=960:720:0:85' : 'crop=836:560:76:200';"
new_crop = "const cropF = isNativeFullScreen ? 'crop=1280:720:0:85' : 'crop=1204:605:76:200';"
text = text.replace(old_crop, new_crop)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
