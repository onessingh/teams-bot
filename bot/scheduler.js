/**
 * scheduler.js — Server-side Live Class Scheduler
 * 
 * Runs every 5 minutes via GitHub Actions cron.
 * Checks Firebase live_queue for any WAITING class within 20 minutes.
 * If found, triggers the Live Class Worker workflow via GitHub API.
 * No browser, no token expiry — fully server-side.
 */

require('dotenv').config();
const admin = require('firebase-admin');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64 || !process.env.FIREBASE_DB_URL) {
  console.error('Missing Firebase credentials.');
  process.exit(1);
}

if (!process.env.GH_SCHEDULER_TOKEN) {
  console.error('Missing GH_SCHEDULER_TOKEN secret. Please add it in GitHub repo Settings > Secrets.');
  process.exit(1);
}

const serviceAccount = JSON.parse(
  Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8')
);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();
const REPO = process.env.GITHUB_REPOSITORY || 'onessingh/teams-bot';
const GH_TOKEN = process.env.GH_SCHEDULER_TOKEN;
const TRIGGER_WINDOW_MS = 20 * 60 * 1000; // 20 minutes before class
const LATE_WINDOW_MS = 5 * 60 * 1000;     // 5 minutes after class start (still trigger)

async function checkAndTrigger() {
  console.log('[Scheduler] Checking Firebase live_queue...');
  const snap = await db.ref('live_queue').once('value');
  const now = Date.now();
  
  if (!snap.exists()) {
    console.log('[Scheduler] live_queue is empty. Nothing to do.');
    return false;
  }

  let triggered = false;
  const items = [];
  snap.forEach(child => {
    items.push({ id: child.key, ...child.val() });
  });

  // 1. Fetch currently running workers (status = in_progress or queued)
  console.log('[Scheduler] Checking running Live Class Workers on GitHub...');
  let activeWorkers = 0;
  try {
    const runsRes = await fetch(
      `https://api.github.com/repos/${REPO}/actions/workflows/live-bot.yml/runs?per_page=10`,
      { headers: { 'Authorization': `Bearer ${GH_TOKEN}`, 'Accept': 'application/vnd.github.v3+json' } }
    );
    const runsData = await runsRes.json();
    if (runsData.workflow_runs) {
      activeWorkers = runsData.workflow_runs.filter(r => r.status === 'in_progress' || r.status === 'queued').length;
    }
  } catch(e) {
    console.log('[Scheduler] Error checking running workers:', e.message);
  }
  console.log(`[Scheduler] Currently active workers running/queued: ${activeWorkers}`);

  // 2. Filter WAITING classes in trigger window
  const waitingItems = items.filter(item => {
    const status = item.status || '';
    const scheduledTime = item.scheduledTime || 0;
    if (status !== 'WAITING') return false;
    if (scheduledTime <= 0) return true; // immediate class
    return now >= scheduledTime - TRIGGER_WINDOW_MS && now <= scheduledTime + LATE_WINDOW_MS;
  });

  console.log(`[Scheduler] WAITING classes in window: ${waitingItems.length}`);

  if (waitingItems.length === 0) {
    console.log('[Scheduler] No WAITING classes in trigger window right now.');
    return false;
  }

  // 3. Trigger a separate Live Class Worker for EVERY WAITING class!
  let triggeredCount = 0;
  for (const item of waitingItems) {
    console.log(`[Scheduler] Triggering Live Class Worker for: ${item.title || item.id} (Account: ${item.accountId || 'default'})`);
    try {
      const triggerRes = await fetch(
        `https://api.github.com/repos/${REPO}/actions/workflows/live-bot.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${GH_TOKEN}`,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ ref: 'main' })
        }
      );

      if (triggerRes.status === 204) {
        console.log(`[Scheduler] ✅ Successfully triggered Live Class Worker for [${item.title || item.id}]`);
        triggeredCount++;
        await new Promise(r => setTimeout(r, 1000));
      } else {
        const errText = await triggerRes.text();
        console.error(`[Scheduler] ❌ Failed to trigger: ${triggerRes.status} — ${errText}`);
      }
    } catch(err) {
      console.error(`[Scheduler] Trigger error:`, err.message);
    }
  }

  return triggeredCount > 0;
}

checkAndTrigger()
  .then(triggered => {
    console.log(triggered ? '[Scheduler] Done — bot was triggered or already running.' : '[Scheduler] Done — no classes need triggering right now.');
    process.exit(0);
  })
  .catch(err => {
    console.error('[Scheduler] Fatal error:', err);
    process.exit(1);
  });
