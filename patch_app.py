with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

# Update addBtn listener to include accountId
old_add = r'''        push\(ref\(db, 'queue'\), \{
            title: "Class " \+ new Date\(\)\.toLocaleString\(\),
            url: url,
            status: 'WAITING',
            maxMs: maxMs,
            addedAt: Date\.now\(\)
        \}\);'''
new_add = '''        const recordedAccountSelect = document.getElementById('recorded-account');
        const accountId = recordedAccountSelect ? recordedAccountSelect.value : 'default';
        push(ref(db, 'queue'), {
            title: "Class " + new Date().toLocaleString(),
            url: url,
            status: 'WAITING',
            maxMs: maxMs,
            addedAt: Date.now(),
            accountId: accountId
        });'''
text = re.sub(old_add, new_add, text)

# Update dropdown population to also include recorded-account
old_pop = r'''    if \(liveAccountSelect\) \{
        liveAccountSelect\.innerHTML = '';
        accounts\.forEach\(acc => \{
            const opt = document\.createElement\('option'\);
            opt\.value = acc;
            opt\.innerText = acc === 'teams_cookies' \? 'Default Account' : acc;
            liveAccountSelect\.appendChild\(opt\);
        \}\);
    \}'''
new_pop = '''    if (liveAccountSelect) {
        liveAccountSelect.innerHTML = '';
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc;
            opt.innerText = acc === 'teams_cookies' ? 'Default Account' : acc;
            liveAccountSelect.appendChild(opt);
        });
    }
    const recordedAccountSelect = document.getElementById('recorded-account');
    if (recordedAccountSelect) {
        recordedAccountSelect.innerHTML = '';
        accounts.forEach(acc => {
            const opt = document.createElement('option');
            opt.value = acc;
            opt.innerText = acc === 'teams_cookies' ? 'Default Account' : acc;
            recordedAccountSelect.appendChild(opt);
        });
    }'''
text = re.sub(old_pop, new_pop, text)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
