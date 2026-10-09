import re

with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    text = f.read()
text = text.replace("await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null });",
                    "await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null, run_url: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID : null });")
with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(text)

with open('bot/index.js', 'r', encoding='utf-8') as f:
    text2 = f.read()
text2 = text2.replace("await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null });",
                      "await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null, run_url: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID : null });")
with open('bot/index.js', 'w', encoding='utf-8') as f:
    f.write(text2)
