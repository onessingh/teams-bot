const fs = require('fs');

const code = 
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');
const recordLiveClass = require('./live-recorder');
const { doTeamsLogin } = require('./teamsLogin');

const MAX_MS = parseInt(process.env.MAX_RECORDING_MS || 18000000, 10);
const OUTPUT_DIR = path.join(process.cwd(), 'recordings');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
  });
}
const db = admin.database();
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function handleLoginRequest() {
  const statusSnap = await db.ref('state/login_status').once('value');
  if (statusSnap.val() !== 'REQUESTED') return;
  console.log('[DEBUG] Login request received.');
  try {
    await doTeamsLogin(db);
  } catch (error) {
    console.error('Login error:', error);
    await db.ref('state/login_status').set('FAILED');
  }
}

async function claimNextWaiting() {
  const snap = await db.ref('live_queue').once('value');
  let selected = null;
  const now = Date.now();
  
  snap.forEach(child => {
    const item = child.val() || {};
    if (item.status === 'WAITING' && item.url) {
      // If it's scheduled, check if it's within our buffer
      if (item.scheduledTime) {
        // We allow claiming if scheduled time is within next 20 mins, or in the past
        if (item.scheduledTime <= now + 20 * 60 * 1000) {
            // Find the closest one
            if (!selected || (item.scheduledTime < selected.scheduledTime)) {
                selected = { id: child.key, ...item };
            }
        }
      } else {
         // Immediate class
         if (!selected) selected = { id: child.key, ...item };
      }
    }
  });

  if (!selected) return null;

  const itemRef = db.ref(\live_queue/\\);
  const currentSnap = await itemRef.once('value');
  const current = currentSnap.val();
  
  if (current && current.status === 'WAITING') {
    await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null });
    return selected;
  }
  return null;
}

async function getCookies(accountId) {
  const target = accountId && accountId !== 'default' ? accountId : 'teams_creds';
  const snap = await db.ref('config/' + target).once('value');
  const creds = snap.val();
  if (!creds || !Array.isArray(creds.cookies) || !creds.cookies.length) {
    throw new Error('No Teams session cookies found for ' + target + '. Please login from the dashboard first.');
  }
  return creds.cookies;
}

async function processItem(item) {
  const ref = db.ref(\live_queue/\\);
  const safeName = String(item.title || \live-\\).replace(/[^a-z0-9._-]+/gi, '_').slice(0, 80);
  const outputPath = path.join(OUTPUT_DIR, \\-\.mp4\);

  try {
    // Smart Sleep Buffer
    if (item.scheduledTime) {
      const waitTime = item.scheduledTime - Date.now();
      if (waitTime > 0) {
        console.log(\[SMART CRON] Bot woke up early. Sleeping for \ seconds until exact class time...\);
        await ref.update({ status: 'SLEEPING_UNTIL_START', updatedAt: Date.now() });
        await sleep(waitTime);
      }
    }

    await ref.update({ status: 'OPENING_RECORDING', updatedAt: Date.now() });
    const cookies = await getCookies(item.accountId);

    await ref.update({ status: 'RECORDING', updatedAt: Date.now() });

    const result = await recordLiveClass(item.url, outputPath, cookies, { maxMs: item.maxMs || MAX_MS });

    await ref.update({ status: 'UPLOADING', upload_progress: 0, updatedAt: Date.now() });
    // Upload logic here (assuming uploadToYouTube exists or we use fallback)
    // For now we will just assume success and rely on artifact fallback if we haven't ported uploadToYouTube
    const uploadToYouTube = require('./youtube');
    const youtubeUrl = await uploadToYouTube(result.outputPath, item.title || safeName, async (pct) => {
        await ref.update({ upload_progress: pct, updatedAt: Date.now() });
    });

    await ref.update({ status: 'COMPLETED', youtube_url: youtubeUrl, completedAt: Date.now(), updatedAt: Date.now(), error: null });
    console.log(\? Live class completed.\);
  } catch (error) {
    console.error(\? \ failed:\, error);
    const message = String(error?.message || error).slice(0, 1000);
    const needsLogin = /session|login|signed in|authentication/i.test(message);
    await ref.update({
      status: needsLogin ? 'TEAMS_LOGIN_REQUIRED' : 'FAILED',
      error: message,
      updatedAt: Date.now()
    });
  } finally {
    try { if (fs.existsSync(outputPath)) { fs.renameSync(outputPath, 'fallback_video.mp4'); } } catch (_) {}
  }
}

async function workerLoop() {
  while (true) {
    const item = await claimNextWaiting();
    if (!item) {
      console.log('Live Queue is empty. Exiting gracefully.');
      break;
    }
    console.log(\?? Processing live class: \\);
    await processItem(item);
  }
}

async function start() {
  console.log('?? Live Bot is online...');
  await handleLoginRequest();
  console.log('Starting live worker loop...');
  await workerLoop();
  setTimeout(() => process.exit(0), 2000);
}

start().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
;
fs.writeFileSync('bot/live-index.js', code);
