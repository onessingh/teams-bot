import re

with open('.github/workflows/live-bot.yml', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''on:
  workflow_dispatch:
  repository_dispatch:
    types: [start-live-processing]
  schedule:
    - cron: '*/10 * * * *'
'''

text = text.replace('on:\n  workflow_dispatch:\n  repository_dispatch:\n    types: [start-live-processing]', replacement.strip())

with open('.github/workflows/live-bot.yml', 'w', encoding='utf-8') as f:
    f.write(text)
