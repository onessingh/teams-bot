with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_logic = r'''              // Smart Organizer Detection: Check if "Organizer" or "Presenter" group is missing from the list.*?return false;'''
new_logic = '''              // Check if bot is completely alone
              if (text.includes("In this meeting (1)") || text.includes("Waiting for others to join")) {
                  return true;
              }
              
              // Smart Organizer Detection:
              // If the participant list is open (we see "In this meeting") but there is NO "Organizer" text anywhere on the screen
              if (text.includes("In this meeting") && !text.includes("Organizer")) {
                  return true;
              }
              
              return false;'''

text = re.sub(old_logic, new_logic, text, flags=re.DOTALL)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
