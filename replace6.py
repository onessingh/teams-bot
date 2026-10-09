import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

pattern = r'          if \(currentCount > maxParticipants\) \{.*?if \(currentCount <= 2\) \{.*?meetingEnded = true;\n              \}\n          \}'

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

text = re.sub(pattern, new_exodus, text, flags=re.DOTALL)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
