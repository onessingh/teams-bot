const fs = require('fs');
let code = fs.readFileSync('dashboard/app.js', 'utf8');

// Change cooldown from 60000 (1 min) to 300000 (5 mins)
code = code.replace('setTimeout(() => window.autoTriggerFired = false, 60000); // 1 min cooldown', 'setTimeout(() => window.autoTriggerFired = false, 300000); // 5 min cooldown');
fs.writeFileSync('dashboard/app.js', code);
console.log("Patched auto-trigger cooldown.");
