require('dotenv').config();
const admin = require('firebase-admin');
const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL
});
const db = admin.database();
db.ref('live_queue').once('value', snap => {
    console.log('LIVE QUEUE:');
    if(snap.exists()) {
        snap.forEach(child => console.log(child.key, child.val()));
    } else {
        console.log('empty');
    }
    process.exit(0);
});
