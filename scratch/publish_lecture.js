/**
 * Manual lecture publisher for Solmates.in
 * Can be run from GitHub Actions or locally.
 */
require('dotenv').config();
const { SolmatesClient } = require('../bot/solmates');
const admin = require('firebase-admin');

async function main() {
  const semester = process.env.INPUT_SEMESTER || process.argv[2];
  const subject = process.env.INPUT_SUBJECT || process.argv[3];
  const youtubeUrl = process.env.INPUT_URL || process.argv[4];
  const dateStr = process.env.INPUT_DATE || process.argv[5];

  if (!semester || !subject || !youtubeUrl) {
    console.error('Usage: node publish_lecture.js <semester> <subject> <youtubeUrl> [date]');
    process.exit(1);
  }

  let adminId = process.env.SOLMATES_ADMIN_ID;
  let password = process.env.SOLMATES_ADMIN_PASSWORD;

  if ((!adminId || !password) && process.env.FIREBASE_SERVICE_ACCOUNT_B64 && process.env.FIREBASE_DB_URL) {
    try {
      const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseURL: process.env.FIREBASE_DB_URL
      });
      const snap = await admin.database().ref('config/solmates').once('value');
      const cfg = snap.val();
      if (cfg && cfg.adminId && cfg.password) {
        adminId = cfg.adminId;
        password = cfg.password;
      }
    } catch (e) {
      console.warn('Firebase cred fetch warning:', e.message);
    }
  }

  if (!adminId || !password) {
    throw new Error('Solmates credentials not configured.');
  }

  console.log(`[Manual Publish] Logging in to solmates.in...`);
  const client = new SolmatesClient(adminId, password);
  await client.login();

  const lectureDate = dateStr ? new Date(dateStr) : new Date();

  console.log(`[Manual Publish] Publishing to Semester ${semester} - "${subject}"...`);
  const result = await client.uploadLecture({
    semester: String(semester),
    subject: subject,
    youtubeUrl: youtubeUrl,
    date: lectureDate
  });

  console.log('🎉 Successfully published to solmates.in!');
  console.log(JSON.stringify(result, null, 2));
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Failed:', err.message);
  process.exit(1);
});
