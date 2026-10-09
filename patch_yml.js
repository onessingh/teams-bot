const fs = require('fs');
let yml = fs.readFileSync('.github/workflows/scheduler.yml', 'utf8');
yml = yml.replace('npm install firebase-admin', 'npm install firebase-admin dotenv');
fs.writeFileSync('.github/workflows/scheduler.yml', yml, 'utf8');
console.log('Fixed yml');
