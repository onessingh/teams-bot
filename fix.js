const { initializeApp } = require('firebase/app');
const { getDatabase, ref, get, set } = require('firebase/database');

const firebaseConfig = {
    databaseURL: "https://teams-class-bot-default-rtdb.firebaseio.com",
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

async function fix() {
    const snap = await get(ref(db, 'config/teams_cookies'));
    const cookies = snap.val();
    if (cookies) {
        await set(ref(db, 'config/Raj Singh/cookies'), cookies);
        console.log('Fixed cookies for Raj Singh using pure JS!');
    }
    process.exit(0);
}
fix();
