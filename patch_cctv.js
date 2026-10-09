const fs = require('fs');

// --- 1. Patch bot/live-recorder.js ---
let recCode = fs.readFileSync('bot/live-recorder.js', 'utf8');
const loopRegex = /await sleep\(15000\);\s*\/\/ Check every 15 seconds/;
const loopRepl = `await sleep(15000); // Check every 15 seconds
      try {
        if (options.onFrame) {
            const buf = await page.screenshot({ type: 'jpeg', quality: 30 });
            await options.onFrame('data:image/jpeg;base64,' + buf.toString('base64'));
        }
      } catch (err) {}`;
recCode = recCode.replace(loopRegex, loopRepl);
fs.writeFileSync('bot/live-recorder.js', recCode);

// --- 2. Patch bot/live-index.js ---
let indexCode = fs.readFileSync('bot/live-index.js', 'utf8');

// Add onFrame callback
const statRegex = /onStatus: async \(statusStr\) => \{ await ref\.update\(\{ status: statusStr, updatedAt: Date\.now\(\) \}\); \},/;
const statRepl = `onStatus: async (statusStr) => { await ref.update({ status: statusStr, updatedAt: Date.now() }); },
      onFrame: async (b64) => { await ref.update({ live_frame: b64 }); },`;
indexCode = indexCode.replace(statRegex, statRepl);

// Clear live_frame on upload
const upRegex = /await ref\.update\(\{ status: 'UPLOADING', upload_progress: 0/;
const upRepl = `await ref.update({ status: 'UPLOADING', live_frame: null, upload_progress: 0`;
indexCode = indexCode.replace(upRegex, upRepl);

// Clear live_frame on error
const errRegex = /status: needsLogin \? 'TEAMS_LOGIN_REQUIRED' : 'FAILED',/;
const errRepl = `status: needsLogin ? 'TEAMS_LOGIN_REQUIRED' : 'FAILED',
      live_frame: null,`;
indexCode = indexCode.replace(errRegex, errRepl);
fs.writeFileSync('bot/live-index.js', indexCode);

// --- 3. Patch dashboard/app.js ---
let appCode = fs.readFileSync('dashboard/app.js', 'utf8');
const renderRegex = /<div id="elapsed-\$\{item\.id\}" class="text-xs font-bold text-red-600 mt-2 empty:hidden"><\/div>/;
const renderRepl = `<div id="elapsed-\${item.id}" class="text-xs font-bold text-red-600 mt-2 empty:hidden"></div>
                \${(item.status === 'RECORDING' && item.live_frame) ? \`
                <div class="mt-3 relative">
                    <span class="absolute top-2 left-2 bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1 shadow">
                        <span class="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span> LIVE PREVIEW
                    </span>
                    <img src="\${item.live_frame}" class="w-full rounded-lg border border-gray-200 shadow-sm object-cover aspect-video" alt="Live Preview">
                </div>
                \` : ''}`;
appCode = appCode.replace(renderRegex, renderRepl);
fs.writeFileSync('dashboard/app.js', appCode);

console.log("All patches applied successfully.");
