import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace any malformed console.log for sudden mass exodus
text = re.sub(r'console\.log\(\[DEBUG\] Sudden mass exodus detected!.*?\);', 
              'console.log([DEBUG] Sudden mass exodus detected! Recent max was , now . Ending meeting.);', 
              text)

# Replace any malformed console.log for small meeting drop
text = re.sub(r'console\.log\(\[DEBUG\] Small meeting drop detected!.*?\);', 
              'console.log([DEBUG] Small meeting drop detected! Recent max was , now . Ending meeting.);', 
              text)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
