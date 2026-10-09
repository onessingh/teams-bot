import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add let lobbyWaitLoops = 0; near loopCount
text = text.replace('let loopCount = 0;', 'let loopCount = 0;\n      let lobbyWaitLoops = 0;')

# Update evaluate block
old_eval = '''            // Extract participant count
            const match = text.match(/In this meeting \((\d+)\)/);
            if (match) {
                currentCount = parseInt(match[1], 10);
            }
            
            return { ended, currentCount, text };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;'''

new_eval = '''            // Extract participant count
            const match = text.match(/In this meeting \((\d+)\)/);
            if (match) {
                currentCount = parseInt(match[1], 10);
            }
            
            const inLobby = text.includes("We've let people in the meeting know you're waiting") || text.includes("When the meeting starts, we'll let people know you're waiting");
            
            return { ended, currentCount, text, inLobby };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        // Lobby Timeout Logic (10 minutes)
        if (stats.inLobby) {
            lobbyWaitLoops++;
            if (lobbyWaitLoops > 40) {
                console.log([DEBUG] Lobby timeout reached (10 minutes without being admitted). Ending meeting.);
                meetingEnded = true;
            }
        } else {
            lobbyWaitLoops = 0; // Reset if admitted
        }'''

text = text.replace(old_eval, new_eval)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
