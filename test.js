const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');
const search = `if (elapsedDiv) elapsedDiv.innerHTML = '<span class="text-blue-600">Auto-triggering now...</span>';`;
console.log('Exists in file:', appJs.includes(search));
