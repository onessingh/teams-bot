with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

import re

old_pop = r'''onValue\(ref\(db, 'config'\), \(snap\) => \{
    const config = snap\.val\(\);
    const sel = document\.getElementById\('live-account'\);
    if \(sel && config\) \{
        sel\.innerHTML = '';
        Object\.keys\(config\)\.forEach\(k => \{
            if \(config\[k\] && config\[k\]\.email\) \{
                sel\.innerHTML \+= \<option value="\$\{k\}"\>\$\{k\} \(\$\{config\[k\]\.email\}\)\</option\>\;
            \}
        \}\);
        if \(sel\.innerHTML === ''\) \{
            sel\.innerHTML = '\<option value="teams_creds"\>Default Account\</option\>';
        \}
    \}
\}\);'''

new_pop = '''onValue(ref(db, 'config'), (snap) => {
    const config = snap.val();
    const sel = document.getElementById('live-account');
    const recSel = document.getElementById('recorded-account');
    
    if (config) {
        let optionsHtml = '';
        Object.keys(config).forEach(k => {
            if (config[k] && config[k].email) {
                optionsHtml += <option value=""> ()</option>;
            }
        });
        if (optionsHtml === '') {
            optionsHtml = '<option value="teams_creds">Default Account</option>';
        }
        
        if (sel) sel.innerHTML = optionsHtml;
        if (recSel) recSel.innerHTML = optionsHtml;
    }
});'''

text = re.sub(old_pop, new_pop, text, flags=re.DOTALL)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
