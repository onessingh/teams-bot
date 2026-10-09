import re

with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    text = f.read()

replacement = '''    const now = Date.now();
    snap.forEach(child => {
      const item = child.val() || {};
      if (!selected && item.status === 'WAITING' && item.url) {
        if (item.scheduledTime) {
          if (now >= item.scheduledTime - (15 * 60 * 1000)) {
            selected = { id: child.key, ...item };
          }
        } else {
          selected = { id: child.key, ...item };
        }
      }
    });'''

text = re.sub(r'    snap\.forEach\(child => \{[\s\S]*?    \}\);', replacement, text)

with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(text)
