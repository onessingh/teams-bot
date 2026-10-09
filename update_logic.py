with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('let maxParticipants = 0;', 'let maxParticipants = 0;\n      const recentCounts = [];')

old_block = '''          if (currentCount > maxParticipants) {
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

new_block = '''          if (currentCount > maxParticipants) {
              maxParticipants = currentCount;
          }
          
          if (currentCount > 0) {
              recentCounts.push(currentCount);
              if (recentCounts.length > 8) recentCounts.shift(); // 2-minute sliding window
          }

          // Sudden Mass Exodus Detection (Sudden drop within 2 mins)
          if (loopCount > 20 && recentCounts.length >= 4) {
              const recentMax = Math.max(...recentCounts);
              if (recentMax > 5) {
                  // If count drops suddenly to <= 60% of recent max
                  if (currentCount <= Math.ceil(recentMax * 0.60)) {
                      console.log([DEBUG] Sudden mass exodus detected! Recent max was , now . Ending meeting.);
                      meetingEnded = true;
                  }
              } else if (recentMax > 1 && recentMax <= 5) {
                  // Small meeting drop
                  if (currentCount <= 2 && currentCount < recentMax) {
                      console.log([DEBUG] Small meeting drop detected! Recent max was , now . Ending meeting.);
                      meetingEnded = true;
                  }
              }
          }'''

text = text.replace(old_block, new_block)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
