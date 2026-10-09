const fs = require('fs');
let code = fs.readFileSync('dashboard/app.js', 'utf8');

const regex = /<span>Added: \$\{new Date\(item\.addedAt\)\.toLocaleString\(\)\}<\/span>/;
const replacement = `<span>\${item.scheduledTime ? 'Scheduled: ' + new Date(item.scheduledTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'Added: ' + new Date(item.addedAt).toLocaleString()}</span>`;

code = code.replace(regex, replacement);
fs.writeFileSync('dashboard/app.js', code);
