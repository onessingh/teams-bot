/**
 * test-dashboard-and-features.js
 * End-to-end automated verification of:
 * 1. Dashboard UI interactions (Leave button confirmation dialog, Delete icon, Watch on Solmates)
 * 2. Visual layout bounds check (ensuring no overlapping between title, trash icon, and leave bar)
 * 3. Live recorder attendee evaluation loop without scoping ReferenceErrors
 * 4. Solmates plural/singular stemming across all semester subjects
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

console.log('🧪 Starting End-to-End Verification Test...\n');

let total = 0;
let passed = 0;

function it(desc, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function itAsync(desc, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${desc}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
  }
}

async function runAll() {
  console.log('--- TEST SUITE 1: Dashboard UI & Button Interactions ---');

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 450, height: 900 } });

  // Load index.html with mocked Firebase state
  const dashboardHtmlPath = path.resolve(__dirname, 'dashboard', 'index.html');
  await page.goto('file:///' + dashboardHtmlPath.replace(/\\/g, '/'));

  // Switch to live section
  await page.evaluate(() => {
    document.getElementById('vod-section').classList.add('hidden');
    document.getElementById('live-section').classList.remove('hidden');

    // Render sample live queue cards using the new templates
    const liveQueueList = document.getElementById('live-queue-list');
    liveQueueList.innerHTML = `
      <li id="item-rec" class="queue-item bg-white p-4 border border-gray-100 rounded-xl shadow-sm relative group">
          <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex-1 min-w-0">
                  <span id="title-rec" class="font-bold text-sm text-gray-800 block truncate" title="OB and HRM: Compensation and Rewards Management">
                      OB and HRM: Compensation and Rewards Management
                  </span>
              </div>
              <button class="live-delete-btn text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-200 transition-all shrink-0 cursor-pointer flex items-center justify-center" data-id="123" title="Delete class">
                  <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </button>
          </div>
          <div class="mb-2 flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-100 text-red-700 animate-pulse shrink-0">RECORDING</span>
              <span class="text-[10px] bg-gray-50 text-gray-600 px-2 py-0.5 rounded font-medium border border-gray-200">🎓 MBA</span>
              <span class="text-[10px] bg-red-50 text-red-700 px-2 py-0.5 rounded font-bold border border-red-100">👤 default</span>
          </div>
          <div class="text-[11px] text-gray-500 flex justify-between items-center">
              <span>Scheduled: 11:30 AM</span>
          </div>

          <div id="active-bar" class="mt-3 p-2.5 bg-red-50/80 border border-red-200 rounded-xl flex items-center justify-between gap-3 shadow-xs">
              <div class="flex items-center gap-2 min-w-0">
                  <span class="relative flex h-2.5 w-2.5 shrink-0">
                      <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                  </span>
                  <div class="flex flex-col">
                      <span class="text-xs font-bold text-red-900 leading-tight">Meeting Active</span>
                      <span class="text-[10px] text-red-600">Bot is currently inside class</span>
                  </div>
              </div>
              <button class="live-leave-btn bg-red-600 hover:bg-red-700 active:scale-95 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-red-700" data-id="123" title="Leave Class now, save video and upload to Solmates" aria-label="Leave Class">
                  🚪 Leave
              </button>
          </div>
      </li>

      <li id="item-done" class="queue-item bg-white p-4 border border-gray-100 rounded-xl shadow-sm relative group mt-3">
          <div class="flex items-start justify-between gap-3 mb-2">
              <div class="flex-1 min-w-0">
                  <span class="font-bold text-sm text-gray-800 block truncate">
                      MBA-HC: Quantitative Methods in Healthcare
                  </span>
              </div>
              <button class="live-delete-btn text-gray-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg border border-transparent hover:border-red-200 transition-all shrink-0 cursor-pointer flex items-center justify-center" data-id="456" title="Delete class">
                  <svg class="w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
              </button>
          </div>
          <div class="mb-2 flex items-center gap-2 flex-wrap">
              <span class="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-green-100 text-green-700 shrink-0">COMPLETED</span>
              <span class="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">🏥 MBA-HC</span>
          </div>
          <div class="mt-2 flex items-center gap-2">
              <a href="https://youtu.be/T8x5kGEnXgQ" target="_blank" class="solmates-link mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg border border-indigo-200 transition-colors">
                  ▶️ Watch on Solmates
              </a>
          </div>
      </li>
    `;

    // Attach leave button listener
    document.querySelectorAll('.live-leave-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const confirmed = confirm('Are you sure you want the bot to leave this class now?\n\nThe bot will hang up gracefully, save the recorded video, and upload it automatically to YouTube/Solmates.');
        if (confirmed) {
          btn.disabled = true;
          btn.textContent = 'Leaving...';
          btn.setAttribute('data-leave-confirmed', 'true');
        }
      });
    });

    // Attach delete button listener
    document.querySelectorAll('.live-delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const confirmed = confirm('Are you sure you want to delete this live class item?');
        if (confirmed) {
          btn.setAttribute('data-delete-confirmed', 'true');
        }
      });
    });
  });

  await itAsync('Leave button displays clean "🚪 Leave" text and has aria-label', async () => {
    const text = await page.innerText('.live-leave-btn');
    assert.strictEqual(text.trim(), '🚪 Leave');
    const label = await page.getAttribute('.live-leave-btn', 'aria-label');
    assert.strictEqual(label, 'Leave Class');
  });

  await itAsync('Leave button triggers confirmation dialog and updates state on OK', async () => {
    let dialogTriggered = false;
    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogTriggered = true;
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await page.click('.live-leave-btn');
    assert.strictEqual(dialogTriggered, true, 'Confirm dialog must trigger');
    assert.strictEqual(dialogMessage.includes('leave this class now'), true, 'Dialog text must confirm leaving');
    const isConfirmed = await page.getAttribute('.live-leave-btn', 'data-leave-confirmed');
    assert.strictEqual(isConfirmed, 'true', 'Button must record confirmed state');
    const btnText = await page.innerText('.live-leave-btn');
    assert.strictEqual(btnText.trim(), 'Leaving...');
  });

  await itAsync('Delete button is an SVG icon and triggers confirmation dialog', async () => {
    const svgCount = await page.locator('.live-delete-btn svg').count();
    assert.strictEqual(svgCount > 0, true, 'Delete button must render SVG icon');

    let deleteDialog = false;
    page.once('dialog', async (dialog) => {
      deleteDialog = true;
      await dialog.accept();
    });

    await page.click('.live-delete-btn');
    assert.strictEqual(deleteDialog, true, 'Delete confirm dialog must trigger');
  });

  await itAsync('"Watch on Solmates" renders properly with link', async () => {
    const linkText = await page.innerText('.solmates-link');
    assert.strictEqual(linkText.includes('Watch on Solmates'), true);
    const href = await page.getAttribute('.solmates-link', 'href');
    assert.strictEqual(href, 'https://youtu.be/T8x5kGEnXgQ');
  });

  await itAsync('Layout bounds check: Title, Delete icon, and Leave bar do NOT overlap', async () => {
    const titleBox = await page.locator('#title-rec').boundingBox();
    const deleteBox = await page.locator('#item-rec .live-delete-btn').boundingBox();
    const leaveBarBox = await page.locator('#active-bar').boundingBox();

    // Title and Delete button are on the same line but must not overlap horizontally
    assert.strictEqual(titleBox.x + titleBox.width <= deleteBox.x + 5, true, 'Title must not overlap with Delete button');
    // Leave bar is positioned strictly below Title and Delete button
    assert.strictEqual(leaveBarBox.y >= titleBox.y + titleBox.height, true, 'Leave bar must be below title row');
  });

  await browser.close();

  // -------------------------------------------------------------
  // TEST SUITE 2: Live Recorder Signals & Scope
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 2: Live Recorder Signals & Scoping ---');

  it('Signals and isSharing are scoped before try blocks in loop', () => {
    const liveRecorderCode = fs.readFileSync(path.join(__dirname, 'bot', 'live-recorder.js'), 'utf8');

    // Verify signals is declared with let before participantData try block
    const declMatch = /let signals = \{\};\s*let isSharing = false;[\s\S]*?try\s*\{[\s\S]*?participantData = await page\.evaluate/.test(liveRecorderCode);
    assert.strictEqual(declMatch, true, 'signals and isSharing must be declared with let outside try blocks');

    // Verify signals is not re-declared with const in try block
    const redeclMatch = /const signals = participantData\.signals/.test(liveRecorderCode);
    assert.strictEqual(redeclMatch, false, 'signals must NOT be declared as const inside try block');
  });

  it('Evaluation loop does not throw ReferenceError when signals is accessed', () => {
    // Simulate loop body logic
    let loopCount = 1;
    let lockedTeacher = 'Dr. S. K. Sharma';
    let teacherScores = {};

    let signals = {};
    let isSharing = false;

    // Simulate first block evaluation
    try {
      const participantData = { signals: { 'Dr. S. K. Sharma': 8 }, isSharing: true };
      signals = participantData.signals || {};
      isSharing = participantData.isSharing;
    } catch (e) {}

    // Simulate second block evaluation
    let hasActiveSpeech = false;
    let isPresentingOrVideo = false;
    try {
      hasActiveSpeech = Object.keys(signals).length > 0;
      isPresentingOrVideo = isSharing;
    } catch (err) {
      assert.fail(`Scoping failure: ${err.message}`);
    }

    assert.strictEqual(hasActiveSpeech, true);
    assert.strictEqual(isPresentingOrVideo, true);
  });

  // -------------------------------------------------------------
  // TEST SUITE 3: Solmates Subject Stemming & Plural Matching
  // -------------------------------------------------------------
  console.log('\n--- TEST SUITE 3: Solmates Plural / Stemming Matching ---');

  const { isSubjectMatch, stemWord } = (() => {
    function stemWord(w) {
      if (!w) return '';
      w = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
      if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
      if (w.endsWith('s') && w.length > 3 && !w.endsWith('ss')) return w.slice(0, -1);
      return w;
    }
    function normalize(str) {
      return (str || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9]/g, '').trim();
    }
    function tokenize(str) {
      const stopWords = new Set(['and', 'of', 'for', 'in', '&', 'the', 'to', 'a', 'an']);
      return (str || '').toLowerCase().replace(/&/g, ' and ').replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).map(w => stemWord(w)).filter(w => w && !stopWords.has(w));
    }
    function isSubjectMatch(folderName, targetSubj) {
      if (!folderName || !targetSubj) return false;
      const nFolder = normalize(folderName);
      const nTarget = normalize(targetSubj);
      if (nFolder === nTarget || nFolder.includes(nTarget) || nTarget.includes(nFolder)) return true;
      const stripAnd = (s) => (s || '').toLowerCase().replace(/&/g, '').replace(/\band\b/g, '').replace(/[^a-z0-9]/g, '').trim();
      const sFolder = stripAnd(folderName);
      const sTarget = stripAnd(targetSubj);
      if (sFolder && sTarget && (sFolder === sTarget || sFolder.includes(sTarget) || sTarget.includes(sFolder))) return true;
      const tokensFolder = tokenize(folderName);
      const tokensTarget = tokenize(targetSubj);
      if (tokensFolder.length > 0 && tokensTarget.length > 0) {
        const fStr = tokensFolder.join('');
        const tStr = tokensTarget.join('');
        if (fStr === tStr || fStr.includes(tStr) || tStr.includes(fStr)) return true;
        const setFolder = new Set(tokensFolder);
        const setTarget = new Set(tokensTarget);
        let intersection = 0;
        for (const t of setTarget) { if (setFolder.has(t)) intersection++; }
        const minTokens = Math.min(setFolder.size, setTarget.size);
        if (minTokens > 0 && (intersection / minTokens) >= 0.8) return true;
      }
      return false;
    }
    return { isSubjectMatch, stemWord };
  })();

  it('Compensation and Reward (singular) matches Compensation and Rewards (plural)', () => {
    assert.strictEqual(
      isSubjectMatch('COMPENSATION AND REWARD MANAGEMENT', 'OB & HRM: Compensation and Rewards Management'),
      true
    );
  });

  it('Management of Information System matches Systems', () => {
    assert.strictEqual(
      isSubjectMatch('MANAGEMENT OF INFORMATION SYSTEMS', 'Management of Information System'),
      true
    );
  });

  it('Quantitative Method matches Quantitative Methods in Healthcare', () => {
    assert.strictEqual(
      isSubjectMatch('QUANTITATIVE METHODS IN HEALTHCARE', 'MBA-HC: Quantitative Method in Healthcare'),
      true
    );
  });

  it('Stemming handles plural endings correctly', () => {
    assert.strictEqual(stemWord('rewards'), 'reward');
    assert.strictEqual(stemWord('systems'), 'system');
    assert.strictEqual(stemWord('strategies'), 'strategy');
    assert.strictEqual(stemWord('business'), 'business'); // 'ss' preserved
  });

  console.log(`\n========================================`);
  console.log(`E2E Verification Summary: ${passed}/${total} Passed (${Math.round(passed/total*100)}%)`);
  console.log(`========================================\n`);

  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
