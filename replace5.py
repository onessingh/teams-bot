import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add recentCounts array right after maxParticipants
text = text.replace('let maxParticipants = 0;', 'let maxParticipants = 0;\n    const recentCounts = [];')

# Replace the mass exodus block
old_exodus = '''          if (currentCount > maxParticipants) {
              maxParticipants = currentCount;
          }
          
          // Mass Exodus Detection (Class is over when 75% of people leave)
          // Wait at least 10 minutes (40 loops * 15s = 600s) before enforcing this rule
          if (loopCount > 20 && maxParticipants > 5) {
              if (currentCount <= Math.ceil(maxParticipants * 0.60)) {
                  console.log([DEBUG] Mass exodus detected. Max was , now . Ending meeting.);
                  meetingEnded = true;
              }
          }
          
          // If max was very small (e.g. 2-5 people), exit if we drop to 2 or fewer and we waited 10 mins
          if (loopCount > 20 && maxParticipants > 1 && maxParticipants <= 5) {
              if (currentCount <= 2) {
                   console.log([DEBUG] Small meeting drop detected. Max was , now . Ending meeting.);
                   meetingEnded = true;
              }
          }'''

new_exodus = '''          if (currentCount > maxParticipants) {
              maxParticipants = currentCount;
          }
          
          // Maintain a 2-minute history of participant counts (8 loops of 15s = 120s)
          if (currentCount > 0) {
              recentCounts.push(currentCount);
              if (recentCounts.length > 8) {
                  recentCounts.shift();
              }
          }
          
          // Sudden Mass Exodus Detection (Class ends when a large group leaves suddenly)
          // Wait 5 minutes (20 loops) before enforcing this rule
          if (loopCount > 20 && recentCounts.length >= 4) {
              const recentMax = Math.max(...recentCounts);
              
              if (recentMax > 5) {
                  // If current count suddenly drops to 60% or less of what it was recently
                  if (currentCount <= Math.ceil(recentMax * 0.60)) {
                      console.log([DEBUG] Sudden mass exodus detected. Recent max was , now . Ending meeting.);
                      meetingEnded = true;
                  }
              } else if (recentMax > 1 && recentMax <= 5) {
                  // For small meetings, exit if it drops to 2 or fewer
                  if (currentCount <= 2 && currentCount < recentMax) {
                      console.log([DEBUG] Small meeting drop detected. Recent max was , now . Ending meeting.);
                      meetingEnded = true;
                  }
              }
          }'''

text = text.replace(old_exodus, new_exodus)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
