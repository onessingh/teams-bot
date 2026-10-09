import re

with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_logic = """            const inLobby = text.includes("We've let people in the meeting know you're waiting") || text.includes("When the meeting starts, we'll let people know you're waiting");
            
            return { ended, currentCount, text, inLobby };"""

new_logic = """            const inLobby = text.includes("We've let people in the meeting know you're waiting") || text.includes("When the meeting starts, we'll let people know you're waiting");
            
            // Check if meeting UI is completely missing (meaning we were kicked to the main screen)
            const hasMeetingUI = !!document.querySelector('[data-tid="meeting-toolbar"], [data-tid="calling-status-bar"], [data-tid="calls-pip"], .app-svg, video');
            
            return { ended, currentCount, text, inLobby, hasMeetingUI };"""

code = code.replace(old_logic, new_logic)

old_ended = """        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        // Lobby Timeout Logic (10 minutes)"""

new_ended = """        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        // If we were admitted, but now the meeting UI is completely gone for 3 loops (45 seconds), it means the meeting ended.
        if (!stats.inLobby && !stats.hasMeetingUI && loopCount > 10) {
            console.log('[DEBUG] No meeting UI detected (no toolbar, no pip, no video). Meeting likely ended or disconnected.');
            meetingEnded = true;
        }
        
        // Lobby Timeout Logic (10 minutes)"""

code = code.replace(old_ended, new_ended)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Added meeting UI absence detection.")
