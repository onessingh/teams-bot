import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_snippet = re.search(r'const startTime = Date\.now\(\);.*?if \(meetingEnded\) \{', text, flags=re.DOTALL).group(0)

new_snippet = '''const startTime = Date.now();
    let loopCount = 0;
    let maxParticipants = 0;
    
    while (Date.now() - startTime < recordMs) {
      await sleep(15000); // Check every 15 seconds
      loopCount++;

      // Anti-idle
      if (loopCount % 20 === 0) {
        try {
          await page.mouse.move(100 + Math.random() * 500, 100 + Math.random() * 500);
          await sleep(500);
          await page.mouse.move(0, 0);
        } catch (e) {}
      }
      
      // End meeting detection
      try {
        const stats = await page.evaluate(() => {
            const text = document.body.innerText || "";
            let ended = false;
            let currentCount = 0;
            
            if (text.includes("The meeting has ended") || text.includes("was ended") || text.includes("You've left the meeting")) {
                ended = true;
            }
            
            // Check if bot is completely alone
            if (text.includes("In this meeting (1)") || text.includes("Waiting for others to join")) {
                ended = true;
                currentCount = 1;
            }
            
            // Extract participant count
            const match = text.match(/In this meeting \\((\\d+)\\)/);
            if (match) {
                currentCount = parseInt(match[1], 10);
            }
            
            return { ended, currentCount, text };
        });
        
        let meetingEnded = stats.ended;
        const currentCount = stats.currentCount;
        
        if (currentCount > maxParticipants) {
            maxParticipants = currentCount;
        }
        
        // Mass Exodus Detection (Class is over when 75% of people leave)
        // Wait at least 10 minutes (40 loops * 15s = 600s) before enforcing this rule
        if (loopCount > 40 && maxParticipants > 5) {
            if (currentCount <= Math.ceil(maxParticipants * 0.25)) {
                console.log([DEBUG] Mass exodus detected. Max was , now . Ending meeting.);
                meetingEnded = true;
            }
        }
        
        // If max was very small (e.g. 2-5 people), exit if we drop to 2 or fewer and we waited 10 mins
        if (loopCount > 40 && maxParticipants > 1 && maxParticipants <= 5) {
            if (currentCount <= 2) {
                 console.log([DEBUG] Small meeting drop detected. Max was , now . Ending meeting.);
                 meetingEnded = true;
            }
        }

        if (meetingEnded) {'''

text = text.replace(old_snippet, new_snippet)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
