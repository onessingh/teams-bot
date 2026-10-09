const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// I literally cannot get this regex right or the file is playing tricks on me.
// Let's just find the index of "// Improved Auto-Trigger with UI Countdown" and substring it out, since it's at the end of the file.

const startIdx = appJs.indexOf('// Improved Auto-Trigger with UI Countdown');
if (startIdx > -1) {
  appJs = appJs.substring(0, startIdx);
  fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
  console.log('Chopped off the end successfully');
} else {
  console.log('Not found');
}
