const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// I completely missed that there is STILL a checkAutoTrigger function or something similar running on an interval!
// Let's find it.
const regex = /async function checkAutoTrigger\(\) \{[\s\S]*?setInterval\(checkAutoTrigger, 1000\);/g;
appJs = appJs.replace(regex, '');

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Removed checkAutoTrigger');
