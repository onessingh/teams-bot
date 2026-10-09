const fs = require('fs');
let code = fs.readFileSync('bot/live-recorder.js', 'utf8');

const hideCssCode = `
    // Hide contact lists to prevent YouTube PII bans if stuck in PiP
    try {
        await page.addStyleTag({ content: 'table, [role="grid"], [role="list"], .fui-Tree { filter: blur(20px) !important; opacity: 0 !important; visibility: hidden !important; }' });
    } catch(e) {}
`;

code = code.replace("if (options.onStatus) await options.onStatus('ADMITTED_PREPARING_UI');", "if (options.onStatus) await options.onStatus('ADMITTED_PREPARING_UI');\n" + hideCssCode);
fs.writeFileSync('bot/live-recorder.js', code);
console.log("Patched CSS hider.");
