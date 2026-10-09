const fs = require('fs');
let txt = fs.readFileSync('dashboard/app.js', 'utf8');
txt = txt.split('if (item.youtube_url) {').join('if (item.run_url) { linkHtml += `<a href="${item.run_url}" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors mr-2">?? Download Backup</a>`; }\n          if (item.youtube_url) {');
fs.writeFileSync('dashboard/app.js', txt);
