const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

// Replace the initLobbyWaitLoops logic
const oldLobbyRegex = /const inLobby = await page\.evaluate\(\(\) => \{[\s\S]*?if \(\!inLobby\) \{[\s\S]*?admitted = true;[\s\S]*?break;[\s\S]*?\}[\s\S]*?await page\.waitForTimeout\(15000\);/m;

const newLobbyLogic = `const isAdmitted = await page.evaluate(() => {
            // Check for buttons that only exist inside a real meeting (not in lobby)
            const chatBtn = document.querySelector('[data-tid="chat-button"], [aria-label*="Chat" i]');
            const peopleBtn = document.querySelector('[data-tid="roster-button"], [aria-label*="People" i]');
            const reactBtn = document.querySelector('[data-tid="reactions-button"], [aria-label*="React" i]');
            const shareBtn = document.querySelector('[data-tid="share-button"], [aria-label*="Share" i]');
            return !!(chatBtn || peopleBtn || reactBtn || shareBtn);
        });
        
        if (isAdmitted) {
            admitted = true;
            break;
        }
        await page.waitForTimeout(15000);`;

code = code.replace(oldLobbyRegex, newLobbyLogic);
fs.writeFileSync('bot/live-recorder.js', code);
console.log("Patched lobby wait logic.");
