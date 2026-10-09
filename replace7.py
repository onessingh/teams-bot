import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add recentCounts if not there
if 'const recentCounts = [];' not in text:
    text = text.replace('let maxParticipants = 0;', 'let maxParticipants = 0;\n    const recentCounts = [];')

# Replace logic
pattern = r'        if \(currentCount > maxParticipants\) \{.*?\n        \}\n\n        if \(meetingEnded\) \{'
new_block = '''        if (currentCount > maxParticipants) {
            maxParticipants = currentCount;
        }
        
        if (currentCount > 0) {
            recentCounts.push(currentCount);
            if (recentCounts.length > 8) recentCounts.shift();
        }

        if (loopCount > 20 && recentCounts.length >= 4) {
            const recentMax = Math.max(...recentCounts);
            if (recentMax > 5) {
                if (currentCount <= Math.ceil(recentMax * 0.60)) {
                    console.log([DEBUG] Sudden mass exodus detected! Recent max was , now . Ending meeting.);
                    meetingEnded = true;
                }
            } else if (recentMax > 1 && recentMax <= 5) {
                if (currentCount <= 2 && currentCount < recentMax) {
                    console.log([DEBUG] Small meeting drop detected! Recent max was , now . Ending meeting.);
                    meetingEnded = true;
                }
            }
        }

        if (meetingEnded) {'''

text = re.sub(pattern, new_block, text, flags=re.DOTALL)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
