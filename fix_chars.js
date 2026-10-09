const fs = require('fs');

let indexHtml = fs.readFileSync('dashboard/index.html', 'utf8');
indexHtml = indexHtml.replace('dY"1 Recorded Classes', 'Recorded Classes');
indexHtml = indexHtml.replace('dY"\' Live Classes', 'Live Classes');
indexHtml = indexHtml.replace('dY"\' Start Live Bot', 'Start Live Bot');
fs.writeFileSync('dashboard/index.html', indexHtml, 'utf8');

console.log('Fixed index.html characters');
