const fs = require('fs');
let content = fs.readFileSync('bot/live-recorder.js', 'utf8');

// I need to be very careful. The syntax error implies my replacement deleted the declaration of inMeetingMic!
// Let's reset again.
