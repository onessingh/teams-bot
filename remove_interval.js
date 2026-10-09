const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// The block is inside `setInterval(async () => { ... }` ! Let's just remove that entire setInterval.
const removeInterval = `
// Improved Auto-Trigger with UI Countdown
setInterval(async () => {
`;

appJs = appJs.replace(/setInterval\(async \(\) => \{[\s\S]*?\}, 1000\);/g, '');

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Removed setInterval');
