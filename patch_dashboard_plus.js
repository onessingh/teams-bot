const fs = require('fs');
let txt = fs.readFileSync('dashboard/app.js', 'utf8');
txt = txt.split('linkHtml = `<a href="${item.youtube_url}"').join('linkHtml += `<a href="${item.youtube_url}"');
fs.writeFileSync('dashboard/app.js', txt);
