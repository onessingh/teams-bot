import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace VOD payload
vod_payload = '''        const accountId = recordedAccountSelect ? recordedAccountSelect.value : 'default';
        const subject = document.getElementById('vod-subject')?.value || '';
        const semester = document.getElementById('vod-semester')?.value || '';
        
        push(ref(db, 'queue'), {
            title: "Class " + new Date().toLocaleString(),
            subject: subject,
            semester: semester,
            url: url,'''
text = text.replace("const accountId = recordedAccountSelect ? recordedAccountSelect.value : 'default';\n        push(ref(db, 'queue'), {\n            title: \"Class \" + new Date().toLocaleString(),\n            url: url,", vod_payload)

# Replace Live payload
live_payload = '''    try {
        const subject = document.getElementById('live-subject')?.value || '';
        const semester = document.getElementById('live-semester')?.value || '';
        
        await push(ref(db, 'live_queue'), {
            url: url,
            subject: subject,
            semester: semester,
            title: 'Live Class: ' + new Date().toLocaleString(),'''
text = text.replace("    try {\n        await push(ref(db, 'live_queue'), {\n            url: url,\n            title: 'Live Class: ' + new Date().toLocaleString(),", live_payload)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
