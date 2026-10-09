import re

with open("bot/live-recorder.js", "r", encoding="utf-8") as f:
    code = f.read()

old_eval = """            // Also check for video gallery
            const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
            if (hasVideoGallery) return true;
            
            return false;
        });
        
        if (isAdmitted) {
            admitted = true;
            break;
        }"""

new_eval = """            // Also check for video gallery
            const hasVideoGallery = !!document.querySelector('[data-tid="video-gallery"], [data-tid="calling-roster-stage"]');
            if (hasVideoGallery) return true;
            
            // Check for instant drop/kick
            if (lowerText.includes('rejoin') && lowerText.includes('learn about teams')) {
                return 'dropped';
            }
            
            return false;
        });
        
        if (isAdmitted === true) {
            admitted = true;
            break;
        } else if (isAdmitted === 'dropped') {
            console.log('[DEBUG] Call dropped immediately upon joining (Rejoin screen detected). Exiting early.');
            break; // will fall through to !admitted check and exit
        }"""

code = code.replace(old_eval, new_eval)

with open("bot/live-recorder.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Added detection for immediate call drop during lobby.")
