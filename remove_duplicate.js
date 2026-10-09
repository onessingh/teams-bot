const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

const regex = /\/\/ Improved Auto-Trigger with UI Countdown[\s\S]*?body: JSON\.stringify\(\{ event_type: 'start-live-processing' \}\)\s*\}\);\s*if \(response\.ok\) \{[\s\S]*?\}\s*\}\s*\}\s*\}\s*\}, 1000\);/g;

appJs = appJs.replace(regex, '');
appJs = appJs.replace(/\/\/ Improved Auto-Trigger with UI Countdown[\s\S]*?\}, 1000\);/g, '');

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
