require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { doTeamsLogin } = require('./teamsLogin');
const { recordClass } = require('./recorder');
const { uploadToYouTube } = require('./youtube');

if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64 || !process.env.FIREBASE_DB_URL) {
  console.error('Missing Firebase credentials.');
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
const OUTPUT_DIR = path.resolve(process.env.RECORDINGS_DIR || './recordings');
const MAX_MS = Number(process.env.MAX_RECORDING_MS || 7200000);
let workerRunning = false;

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
console.log('🤖 Bot is online and listening to Firebase...');

async function handleLoginRequest() {
  const statusSnap = await db.ref('state/login_status').once('value');
  const status = statusSnap.val();
  console.log(`[DEBUG] Current login_status in DB is: '${status}'`);
  
  if (status !== 'REQUESTED') {
    console.log('[DEBUG] Skipping login flow because status is not REQUESTED.');
    return;
  }
  
  console.log('🔔 Login request received.');
  try {
    await doTeamsLogin(db);
  } catch (error) {
    console.error('Login flow error:', error);
    await db.ref('state/login_status').set('FAILED');
  }
}

async function claimNextWaiting() {
  const snap = await db.ref('queue').orderByChild('addedAt').once('value');
  let selected = null;
  snap.forEach(child => {
    const item = child.val() || {};
    if (!selected && item.status === 'WAITING' && item.url) {
      selected = { id: child.key, ...item };
    }
  });
  if (!selected) return null;

  const itemRef = db.ref(`queue/${selected.id}`);
  const currentSnap = await itemRef.once('value');
  const current = currentSnap.val();
  
  if (current && current.status === 'WAITING') {
    await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null });
    return selected;
  }

  return null;
}

async function getCookies(accountId) {
  const targetKey = accountId && accountId !== 'default' ? accountId : 'teams_creds';
  const snap = await db.ref('config/' + targetKey).once('value');
  const creds = snap.val();
  
  // Legacy support for 'teams_cookies' if 'teams_creds' doesn't have it
  if (!creds || !Array.isArray(creds.cookies) || !creds.cookies.length) {
      if (targetKey === 'teams_creds') {
          const oldSnap = await db.ref('config/teams_cookies').once('value');
          const oldCookies = oldSnap.val();
          if (Array.isArray(oldCookies) && oldCookies.length) {
              return oldCookies;
          }
      }
      throw new Error(`No Teams session cookies found for account '${targetKey}'. Please login from the dashboard first.`);
  }
  return creds.cookies;
}

async function processItem(item) {
  const ref = db.ref(`queue/${item.id}`);
  const safeName = String(item.title || `class-${item.id}`)
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80);
  const outputPath = path.join(OUTPUT_DIR, `${Date.now()}-${safeName}.mp4`);

  try {
    await ref.update({ status: 'OPENING_RECORDING', updatedAt: Date.now() });
    const cookies = await getCookies(item.accountId);
    const targetKey = item.accountId && item.accountId !== 'default' ? item.accountId : 'teams_creds';
    const credsSnap = await db.ref('config/' + targetKey).once('value');
    const creds = credsSnap.val();

    await ref.update({ status: 'RECORDING', updatedAt: Date.now() });
    const result = await recordClass(item.url, outputPath, cookies, { 
      maxMs: item.maxMs || MAX_MS,
      resumeTime: item.resumeTime || 0,
      creds: creds,
      onAuthError: async (b64Image) => {
        await db.ref('state/mfa_screenshot').set(b64Image);
        await db.ref('state/login_status').set('WAITING_FOR_MFA');
      }
    });

    await ref.update({ status: 'UPLOADING', upload_progress: 0, updatedAt: Date.now() });
    const youtubeUrl = await uploadToYouTube(result.outputPath, item.subject || item.title || safeName, async (pct) => {
        await ref.update({ upload_progress: pct, updatedAt: Date.now() });
    });

    await ref.update({
      status: 'COMPLETED',
      youtube_url: youtubeUrl,
      completedAt: Date.now(),
      updatedAt: Date.now(),
      error: null
    });
    console.log(`✅ ${item.title} uploaded: ${youtubeUrl}`);

    if (result.wasSplit) {
      const nextPartNum = (item.part || 1) + 1;
      const baseTitle = (item.title || safeName).replace(/ \(Part \d+\)$/, '');
      const newTitle = `${baseTitle} (Part ${nextPartNum})`;
      const newResumeTime = (item.resumeTime || 0) + Math.floor(result.durationRecordedMs / 1000);
      
      await db.ref('queue').push({
        url: item.url,
        title: newTitle,
        status: 'WAITING',
        addedAt: Date.now(),
        maxMs: item.maxMs || MAX_MS,
        resumeTime: newResumeTime,
        part: nextPartNum
      });
      console.log(`📝 Queued next part: ${newTitle} starting at ${newResumeTime}s`);
    }
  } catch (error) {
    console.error(`❌ ${item.title} failed:`, error);
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
  if (workerRunning) return;
  workerRunning = true;
  try {
    while (true) {
      await handleLoginRequest();
      const item = await claimNextWaiting();
      if (!item) break;
      await processItem(item);
    }
  } finally {
    workerRunning = false;
  }
}

async function start() {
  console.log("Starting worker loop...");
  await workerLoop();
  console.log("Queue is empty. Exiting gracefully to save runner minutes.");
  process.exit(0);
}

start().catch(error => {
  console.error("Fatal error in worker:", error);
  process.exit(1);
});

