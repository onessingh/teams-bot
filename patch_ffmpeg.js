const fs = require('fs');

function patchFile(filepath) {
    if (!fs.existsSync(filepath)) return;
    let code = fs.readFileSync(filepath, 'utf8');
    code = code.replace("'-movflags', '+faststart',", "'-movflags', 'frag_keyframe+empty_moov',");
    fs.writeFileSync(filepath, code);
    console.log("Patched FFmpeg args in " + filepath);
}

patchFile('bot/live-recorder.js');
patchFile('bot/recorder.js');
