import re

with open('bot/live-recorder.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace style tag injection
old_style = 'style.innerHTML = "* { cursor: none !important; }";'
new_style = '''style.innerHTML = 
    * { cursor: none !important; }
    div[role="alert"], 
    div[role="banner"],
    div[data-tid^="toast"], 
    div[data-tid^="banner"], 
    .ui-toast, 
    .toast-container, 
    .ts-toast-stack,
    div[aria-label*="notification" i],
    div[aria-live="polite"] {
        display: none !important;
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
    }
;'''
text = text.replace(old_style, new_style)

# Inject Auto-clicker for Dismiss buttons inside the setInterval
old_interval = "setInterval(() => {\n                try {"
new_interval = '''setInterval(() => {
                try {
                    // Aggressively dismiss toasts/popups
                    const btns = document.querySelectorAll('button');
                    btns.forEach(btn => {
                        const t = (btn.textContent || '').trim().toLowerCase();
                        if (t === 'dismiss' || t === 'got it' || t === 'not now') {
                            btn.click();
                        }
                    });'''
text = text.replace(old_interval, new_interval)

with open('bot/live-recorder.js', 'w', encoding='utf-8') as f:
    f.write(text)
