require('dotenv').config();
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { doTeamsLogin } = require('./teamsLogin');
const recordLiveClass = require('./live-recorder');
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
    const snap = await db.ref('live_queue').orderByChild('addedAt').once('value');
    const candidates = [];
    const now = Date.now();
    
    snap.forEach(child => {
        const item = child.val() || {};
        if (item.status === 'WAITING' && item.url) {
            if (!item.scheduledTime || now >= item.scheduledTime - (25 * 60 * 1000)) {
                candidates.push({ id: child.key, ...item });
            }
        }
    });
    
    for (const selected of candidates) {
        const itemRef = db.ref(`live_queue/${selected.id}`);
        // Atomic transaction on full object to safely claim item
        const txResult = await itemRef.transaction((current) => {
            if (current === null) return current; // sync initial data from server
            if (current.status === 'WAITING') {
                current.status = 'STARTING';
                current.startedAt = Date.now();
                current.error = null;
                if (process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID) {
                    current.run_url = 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID;
                }
                return current;
            }
            return; // abort if already claimed
        });
        
        if (txResult.committed && txResult.snapshot.exists()) {
            console.log(`✅ Claimed live class [${selected.id}] (${selected.title}) for recording.`);
            return { id: selected.id, ...txResult.snapshot.val() };
        }
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
  const ref = db.ref(`live_queue/${item.id}`);

  if (!item.url || typeof item.url !== 'string' || !item.url.startsWith('http')) {
    const errStr = `Invalid meeting URL: "${String(item.url).slice(0, 50)}..."`;
    console.error(`? Live Class: ${item.title || item.id} failed:`, errStr);
    await ref.update({ status: 'FAILED', error: errStr, updatedAt: Date.now() });
    return;
  }
  const safeName = String(item.title || `live-${item.id}`)
    .replace(/[^a-z0-9._-]+/gi, '_')
    .slice(0, 80);
  const outputPath = path.join(OUTPUT_DIR, `${Date.now()}-${safeName}.mp4`);

  try {
    await ref.update({ status: 'OPENING_RECORDING', updatedAt: Date.now() });
    const cookies = await getCookies(item.accountId);
    const target = item.accountId || 'teams_creds';
    const credsSnap = await db.ref('config/' + target).once('value');
    const creds = credsSnap.val();

    await ref.update({ status: 'RECORDING', updatedAt: Date.now() });
    const result = await recordLiveClass(item.url, outputPath, cookies, { 
      maxMs: item.maxMs || MAX_MS,
      scheduledTime: item.scheduledTime || 0,
      resumeTime: item.resumeTime || 0,
      creds: creds,
      onStatus: async (statusStr) => { await ref.update({ status: statusStr, updatedAt: Date.now() }); },
      onFrame: async (b64) => { await ref.update({ live_frame: b64 }); },
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


    await ref.update({ status: 'UPLOADING', live_frame: null, upload_progress: 0, updatedAt: Date.now() });
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
      
      await db.ref('live_queue').push({
        url: item.url,
        title: newTitle,
        status: 'WAITING',
        addedAt: Date.now(),
        maxMs: item.maxMs || MAX_MS,
      scheduledTime: item.scheduledTime || 0,
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
      live_frame: null,
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




