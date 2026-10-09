import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''              if (text.includes("The meeting has ended") || text.includes("was ended") || text.includes("You've left the meeting") || text.includes("removed you") || text.includes("You were removed") || text.includes("left the meeting")) {
                  ended = true;
              }'''

text = re.sub(r'\s*if \(text\.includes\("The meeting has ended"\) \|\| text\.includes\("was ended"\) \|\| text\.includes\("You\'ve left the meeting"\)\) \{\s*ended = true;\s*\}', '\n' + replacement, text)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
