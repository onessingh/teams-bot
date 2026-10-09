import re

with open('.github/workflows/live-bot.yml', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''on:
  repository_dispatch:
    types: [start-live-processing]
  workflow_dispatch:
  schedule:
    - cron: '*/10 * * * *'
'''

text = re.sub(r'on:\s*repository_dispatch:\s*types: \[start-live-processing\]\s*workflow_dispatch:', replacement.strip(), text)

with open('.github/workflows/live-bot.yml', 'w', encoding='utf-8') as f:
    f.write(text)
