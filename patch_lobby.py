import sys
import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 2. Lobby
code = re.sub(
    r"\s*while \(initLobbyWaitLoops < 120\) \{.*?admitted = true;\s*break;\s*\}",
    """    while (!admitted && initLobbyWaitLoops < 120) { 
        // Wait in lobby (up to 30 mins)
        const isAdmitted = await page.evaluate(() => {
            const text = document.body.innerText || '';
            console.log('[DEBUG-DUMP] Lobby screen text:', text.replace(/\\n/g, ' | '));
            
            const lowerText = text.toLowerCase();
            const inLobby = lowerText.includes('waiting in the lobby') || 
                            lowerText.includes('we\\'ve let people') ||
                            lowerText.includes('we\\'ll let people') ||
                            lowerText.includes('when the meeting starts') ||
                            lowerText.includes('waiting for others to join') ||
                            lowerText.includes('someone in the meeting should let you in soon');
                            
            if (inLobby) return false;
            
            const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
            if (hasVideoGallery) return true;
            
            return false;
        });
        
        if (isAdmitted) {
            admitted = true;
            break;
        }""",
    code,
    flags=re.DOTALL
)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Python regex patch applied for lobby!")
