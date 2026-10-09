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

async function acquireUploadLock(db, workerId, timeoutMs = 7200000) {
  const lockRef = db.ref('state/upload_lock');
  console.log(`[UPLOAD LOCK] ${workerId} waiting for YouTube upload slot...`);
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const tx = await lockRef.transaction((current) => {
      const now = Date.now();
      if (!current || !current.locked || (now - (current.lockedAt || 0) > 45 * 60 * 1000)) {
        return { locked: true, lockedBy: workerId, lockedAt: now };
      }
      return;
    });
    if (tx.committed && tx.snapshot.exists() && tx.snapshot.val() && tx.snapshot.val().lockedBy === workerId) {
      console.log(`[UPLOAD LOCK] ${workerId} acquired YouTube upload slot successfully!`);
      return true;
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  throw new Error('Timed out waiting for YouTube upload slot.');
}

async function releaseUploadLock(db, workerId) {
  const lockRef = db.ref('state/upload_lock');
  try {
    await lockRef.transaction((current) => {
      if (current && current.lockedBy === workerId) {
        return null;
      }
      return current;
    });
    console.log(`[UPLOAD LOCK] ${workerId} released YouTube upload slot.`);
  } catch (err) {
    console.error('[UPLOAD LOCK] Error releasing lock:', err.message);
  }
}

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
  const candidates = [];
  snap.forEach(child => {
    const item = child.val() || {};
    if ((item.status === 'WAITING' || item.status === 'RETRY_REQUESTED') && item.url) {
      candidates.push({ id: child.key, ...item });
    }
  });

  for (const selected of candidates) {
    const itemRef = db.ref(`queue/${selected.id}`);
    const txResult = await itemRef.transaction((current) => {
      if (current === null) return current;
      if (current.status === 'WAITING' || current.status === 'RETRY_REQUESTED') {
        current.status = 'STARTING';
        current.startedAt = Date.now();
        current.error = null;
        if (!current.run_url && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
          current.run_url = 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID;
        }
        return current;
      }
      return;
    });
    if (txResult.committed && txResult.snapshot.exists()) {
      return { id: selected.id, ...txResult.snapshot.val() };
    }
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
  let targetVideoPath = outputPath;
  let skipRecording = false;
  let result = null;

  function findMp4Files(dir) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        results = results.concat(findMp4Files(full));
      } else if (entry.isFile() && entry.name.endsWith('.mp4') && fs.statSync(full).size > 1024) {
        results.push(full);
      }
    }
    return results;
  }

  // 1. Check local disk for existing video backup from previous attempt
  const localBackups = findMp4Files(OUTPUT_DIR).concat(findMp4Files('.'));
  if (localBackups.length > 0) {
    targetVideoPath = localBackups[0];
    console.log(`[RETRY] Found local video backup: ${targetVideoPath}`);
    skipRecording = true;
  }

  // 2. Check GitHub Run artifact if run_url exists
  if (!skipRecording && item.run_url) {
    const runMatch = item.run_url.match(/runs\/(\d+)/);
    if (runMatch && runMatch[1]) {
      const runId = runMatch[1];
      console.log(`[RETRY] Attempting to download saved video artifact from GitHub Run ID: ${runId}...`);
      try {
        const { execSync } = require('child_process');
        try {
          execSync(`gh run download ${runId} -n recorded-video --dir "${OUTPUT_DIR}"`, { stdio: 'inherit' });
        } catch(e1) {
          execSync(`gh run download ${runId} --dir "${OUTPUT_DIR}"`, { stdio: 'inherit' });
        }

        const downloadedFiles = findMp4Files(OUTPUT_DIR);
        if (downloadedFiles.length > 0) {
          targetVideoPath = downloadedFiles[0];
          console.log(`[RETRY] Found downloaded video backup: ${targetVideoPath}`);
          skipRecording = true;
        } else {
          console.log('[RETRY] No .mp4 video found in downloaded artifact.');
        }
      } catch (err) {
        console.log('[RETRY] Artifact download via gh CLI failed or unavailable:', err.message);
      }
    }
  }

  try {
    if (!skipRecording) {
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

    if (!result || !result.outputPath) {
      throw new Error('Recording ended before output file was created.');
    }

    try {
      if (fs.existsSync('intro.mp4')) {
        console.log('[INFO] Normalizing intro.mp4 for concatenation...');
        const { execSync } = require('child_process');
        execSync('ffmpeg -y -i intro.mp4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=15" -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart normalized_intro.mp4', {stdio: 'inherit'});
        
        if (fs.existsSync('normalized_intro.mp4') && fs.existsSync(result.outputPath)) {
          console.log('[INFO] Concatenating videos using extremely fast stream copy...');
          fs.writeFileSync('concat_list.txt', `file 'normalized_intro.mp4'\nfile '${result.outputPath}'\nfile 'normalized_intro.mp4'\n`);
          const finalPath = result.outputPath.replace('.mp4', '_final.mp4');
          execSync(`ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy "${finalPath}"`, {stdio: 'inherit'});
          if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1024) {
             fs.renameSync(finalPath, result.outputPath);
             console.log('[INFO] Successfully attached intro and outro to the class recording!');
          }
        }
      }
    } catch (err) {
      console.error('[ERROR] Failed to concatenate intro/outro:', err);
    }
    targetVideoPath = result ? result.outputPath : targetVideoPath;
    }

    // Upload to YouTube
    await ref.update({ status: 'WAITING_FOR_UPLOAD_SLOT', updatedAt: Date.now() });
    const workerLockId = `vod_${item.id}_${Date.now()}`;
    const subjectLabel = typeof item.subject === 'string' && item.subject.trim() ? item.subject.trim() : 'Teams Classes';
    let ytResult = null;
    try {
      await acquireUploadLock(db, workerLockId);
      await ref.update({ status: 'UPLOADING', upload_progress: 0, updatedAt: Date.now() });
      ytResult = await uploadToYouTube(targetVideoPath, subjectLabel, async (pct) => {
        await ref.update({ upload_progress: pct, updatedAt: Date.now() });
      });
    } finally {
      await releaseUploadLock(db, workerLockId);
    }

    await ref.update({
      status: 'DONE',
      youtube_url: ytResult?.url || null,
      updatedAt: Date.now()
    });
    console.log(`✅ Done: ${item.title}`);

    // If recording was cut short (max duration), queue next part
    if (result.isPartial) {
      const nextPartNum = (item.part || 1) + 1;
      const newTitle = `${item.title || 'Class'} (Part ${nextPartNum})`;
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

