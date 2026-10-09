import re

# Patch live-index.js
with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    live_code = f.read()
live_code = live_code.replace("const youtubeUrl = await uploadToYouTube(result.outputPath, item.title || safeName, async (pct) => {", 
                              "const youtubeUrl = await uploadToYouTube(result.outputPath, item.subject || item.title || safeName, async (pct) => {")
with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(live_code)

# Patch index.js
with open('bot/index.js', 'r', encoding='utf-8') as f:
    rec_code = f.read()
rec_code = rec_code.replace("const youtubeUrl = await uploadToYouTube(result.outputPath, item.title || safeName, async (pct) => {", 
                            "const youtubeUrl = await uploadToYouTube(result.outputPath, item.subject || item.title || safeName, async (pct) => {")
with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.write(rec_code)
