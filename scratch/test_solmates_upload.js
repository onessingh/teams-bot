const { SolmatesClient } = require('../bot/solmates');
const admin = require('firebase-admin');

async function main() {
  const adminId = process.env.SOLMATES_ADMIN_ID;
  const password = process.env.SOLMATES_ADMIN_PASSWORD;

  console.log('Testing Solmates.in Admin Integration...');
  console.log('Admin ID provided:', adminId ? 'YES (' + adminId.slice(0, 3) + '***)' : 'NO');
  console.log('Password provided:', password ? 'YES (***)' : 'NO');

  if (!adminId || !password) {
    throw new Error('SOLMATES_ADMIN_ID or SOLMATES_ADMIN_PASSWORD missing in env!');
  }

  const client = new SolmatesClient(adminId, password);
  console.log('1. Attempting login to solmates.in...');
  const token = await client.login();
  console.log('✅ Login successful! Token acquired (length: ' + token.length + ')');

  console.log('\n2. Testing upload to Semester 4 "ADDITIONAL COURSES" (Locked Folder)...');
  const res = await client.uploadLecture({
    semester: '4',
    subject: 'ADDITIONAL COURSES',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    date: new Date()
  });

  console.log('✅ Upload completed successfully!');
  console.log('Result:', JSON.stringify(res, null, 2));

  // Also save credentials to Firebase config/solmates if Firebase is available
  if (process.env.FIREBASE_SERVICE_ACCOUNT_B64 && process.env.FIREBASE_DB_URL) {
    try {
      console.log('\n3. Saving solmates credentials to Firebase config/solmates for future use...');
      const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
      admin.initializeApp({
        credential: admin.credential.cert(sa),
        databaseURL: process.env.FIREBASE_DB_URL
      });
      await admin.database().ref('config/solmates').set({
        adminId: adminId,
        password: password,
        updatedAt: Date.now()
      });
      console.log('✅ Saved to Firebase config/solmates!');
    } catch (fbErr) {
      console.warn('Firebase save warning:', fbErr.message);
    }
  }

  console.log('\n🎉 ALL DONE! Check solmates.in under Semester 4 -> ADDITIONAL COURSES!');
  process.exit(0);
}

main().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
