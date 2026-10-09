import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('console.log([DEBUG] Sudden mass exodus detected! Recent max was , now . Ending meeting.);', 'console.log(`[DEBUG] Sudden mass exodus detected! Recent max was ${recentMax}, now ${currentCount}. Ending meeting.`);')
text = text.replace('console.log([DEBUG] Small meeting drop detected! Recent max was , now . Ending meeting.);', 'console.log(`[DEBUG] Small meeting drop detected! Recent max was ${recentMax}, now ${currentCount}. Ending meeting.`);')

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
