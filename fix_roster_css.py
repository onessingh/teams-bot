import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    code = f.read()

# 1. Remove "Hide Participants Pane visually"
old1 = """                    // Hide Participants Pane visually
                    const shareBtn = document.querySelector('button[aria-label*="Share invite"], input[placeholder*="Type a name"]');
                    if (shareBtn) {
                        let pane = shareBtn.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (pane && pane.tagName !== 'BODY') {
                                const r = pane.getBoundingClientRect();
                                if (r.width >= 200 && r.width <= 500 && r.height > window.innerHeight * 0.3) {
                                    pane.style.setProperty('opacity', '0.01', 'important');
                                    pane.style.setProperty('position', 'absolute', 'important');
                                    pane.style.setProperty('right', '-9999px', 'important');
                                    pane.style.setProperty('z-index', '-1', 'important');
                                    break;
                                }
                                pane = pane.parentElement;
                            }
                        }
                    }"""
code = code.replace(old1, "                    // (Participants pane hiding removed)")

# 2. Remove "Force the video stage"
old2 = """                    // Force the video stage
                    const video = document.querySelector('video');
                    if (video) {
                        let stage = video.parentElement;
                        for (let i = 0; i < 15; i++) {
                            if (stage && stage.tagName !== 'BODY') {
                                const r = stage.getBoundingClientRect();
                                if (r.width > window.innerWidth * 0.3 && r.height > window.innerHeight * 0.3) {
                                    stage.style.setProperty('position', 'fixed', 'important');
                                    stage.style.setProperty('top', '0', 'important');
                                    stage.style.setProperty('left', '0', 'important');
                                    stage.style.setProperty('width', '100vw', 'important');
                                    stage.style.setProperty('height', '100vh', 'important');
                                    stage.style.setProperty('z-index', '999', 'important');
                                    stage.style.setProperty('background', '#000', 'important');
                                    stage.style.setProperty('padding', '0', 'important');
                                    stage.style.setProperty('margin', '0', 'important');
                                    break; 
                                }
                                stage = stage.parentElement;
                            }
                        }
                    }"""
code = code.replace(old2, "                    // (Force video stage removed so roster can share screen space)")

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(code)

print("Applied!")
