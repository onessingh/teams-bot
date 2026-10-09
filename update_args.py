with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Find the args array
old_args = r'''      const browser = await chromium\.launch\(\{
        headless: false,
        args: \[
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--start-maximized',
          '--use-fake-ui-for-media-stream',
          // removed fake device to use pulse fake_mic
          '--disable-notifications',
          '--window-size=1280,805',
          '--hide-scrollbars',
          '--mute-audio'
        \]
      \}\);'''

new_args = '''      const browser = await chromium.launch({
        headless: false,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--start-maximized',
          '--use-fake-ui-for-media-stream',
          '--use-fake-device-for-media-stream',
          '--use-file-for-fake-audio-capture=' + path.resolve(__dirname, 'silence.wav'),
          '--disable-notifications',
          '--window-size=1280,805',
          '--hide-scrollbars',
          '--mute-audio'
        ]
      });'''

text = re.sub(old_args, new_args, text, flags=re.DOTALL)
with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
