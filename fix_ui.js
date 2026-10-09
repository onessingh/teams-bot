const fs = require('fs');

// Fix index.html
let indexHtml = fs.readFileSync('dashboard/index.html', 'utf8');
const indexRepairs = [
    ['?? Recorded Classes', 'Recorded Classes'],
    ['?? Live Classes', 'Live Classes'],
    ['?? Start Live Bot', 'Start Live Bot'],
    ['?? Start Cloud Bot', 'Start Cloud Bot'],
    ['?? Download Backup', 'Download Backup']
];
for (const [bad, good] of indexRepairs) {
    indexHtml = indexHtml.split(bad).join(good);
}
fs.writeFileSync('dashboard/index.html', indexHtml, 'utf8');

// Fix app.js
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');
const appRepairs = [
    ['\u26a0\ufe0f No GitHub token!', 'No GitHub token!'],
    ['\u26a0\ufe0f Token expired!', 'Token expired!'],
    ['\u2705 Auto-triggered!', 'Auto-triggered!']
];
for (const [bad, good] of appRepairs) {
    appJs = appJs.split(bad).join(good);
}
fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Fixed UI issues.');
