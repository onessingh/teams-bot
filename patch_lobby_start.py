import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = """    await page.waitForTimeout(10000);

    // Wait for Lobby to clear BEFORE setting up UI and Recording
    console.log('[DEBUG] Waiting to be admitted from lobby...');
    let initLobbyWaitLoops = 0;
    let admitted = false;
    while (initLobbyWaitLoops < 40) {
        const inLobby = await page.evaluate(() => {
            const txt = document.body.textContent || "";
            return txt.includes("We've let people in the meeting know you're waiting") || 
                   txt.includes("When the meeting starts, we'll let people know you're waiting") ||
                   txt.includes("Someone will let you in soon") ||
                   txt.includes("Someone in the meeting should let you in soon");
        });
        
        if (!inLobby) {
            admitted = true;
            break;
        }
        await page.waitForTimeout(15000);
        initLobbyWaitLoops++;
    }

    if (!admitted) {
        console.log('[DEBUG] Lobby timeout reached (10 minutes) before recording started. Exiting.');
        await browser.close();
        return;
    }
    console.log('[DEBUG] Admitted to meeting. Setting up UI (Mic, Hide me, Full screen).');
    await page.waitForTimeout(5000); // Give the meeting UI 5 seconds to fully render"""

text = text.replace("    await page.waitForTimeout(10000);", replacement)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
