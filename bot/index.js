require('dotenv').config();
const admin = require('firebase-admin');
const { doTeamsLogin } = require('./teamsLogin');
// const { startRecording } = require('./recorder'); // (We will connect this next)

// 1. Initialize Firebase Admin
if (!process.env.FIREBASE_SERVICE_ACCOUNT_B64 || !process.env.FIREBASE_DB_URL) {
    console.error("Missing Firebase credentials in .env!");
    process.exit(1);
}

const serviceAccount = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf-8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL
});

const db = admin.database();
console.log("🤖 Bot is online and listening to Firebase...");

// 2. Listen for MS Teams Login Requests
db.ref('state/login_status').on('value', async (snapshot) => {
    const status = snapshot.val();
    if (status === 'REQUESTED') {
        console.log("🔔 Login Request Received from Dashboard!");
        try {
            await doTeamsLogin(db);
        } catch (error) {
            console.error("Error during login flow:", error);
            await db.ref('state/login_status').set('FAILED');
        }
    }
});

// 3. Listen for Queue processing (to be fully implemented in recorder.js later)
db.ref('queue').on('child_added', (snapshot) => {
    const item = snapshot.val();
    if (item.status === 'WAITING') {
        console.log(`📌 Found new class in queue: ${item.title}`);
        // We will trigger recorder here later
    }
});
