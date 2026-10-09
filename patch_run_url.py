import re

with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Add run_url to processing state
text = text.replace("await ref.update({ status: 'PROCESSING', updatedAt: Date.now() });",
                    "await ref.update({ status: 'PROCESSING', updatedAt: Date.now(), run_url: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? https://github.com//actions/runs/ : null });")

with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('bot/index.js', 'r', encoding='utf-8') as f:
    text2 = f.read()

text2 = text2.replace("await ref.update({ status: 'PROCESSING', updatedAt: Date.now() });",
                      "await ref.update({ status: 'PROCESSING', updatedAt: Date.now(), run_url: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? https://github.com//actions/runs/ : null });")

with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.write(text2)
