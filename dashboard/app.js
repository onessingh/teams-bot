import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyDfUN-6PfOIQJnUbiXnQTcbyG9OS_lU4u0",
    authDomain: "teams-class-bot.firebaseapp.com",
    databaseURL: "https://teams-class-bot-default-rtdb.firebaseio.com",
    projectId: "teams-class-bot",
    storageBucket: "teams-class-bot.firebasestorage.app",
    messagingSenderId: "598148324415",
    appId: "1:598148324415:web:4aeefd227685c779006c8a"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

const addBtn = document.getElementById('add-btn');
const linkInput = document.getElementById('teams-link');
const queueList = document.getElementById('queue-list');
const teamsStatus = document.getElementById('teams-status');

// Login UI elements
const settingsBtn = document.getElementById('settings-btn');
const loginModal = document.getElementById('login-modal');
const closeModalBtn = document.getElementById('close-modal-btn');
const startLoginBtn = document.getElementById('start-login-btn');
const msEmail = document.getElementById('ms-email');
const msPassword = document.getElementById('ms-password');
const mfaSection = document.getElementById('mfa-section');
const mfaStatusText = document.getElementById('mfa-status-text');
const mfaScreenshot = document.getElementById('mfa-screenshot');

// Modal logic
settingsBtn.addEventListener('click', () => {
    loginModal.style.display = 'flex';
});

closeModalBtn.addEventListener('click', () => {
    loginModal.style.display = 'none';
    mfaSection.style.display = 'none';
});

// Add link to queue
addBtn.addEventListener('click', () => {
    const url = linkInput.value.trim();
    if(url) {
        push(ref(db, 'queue'), {
            title: "Class " + new Date().toLocaleString(),
            url: url,
            status: 'WAITING',
            addedAt: Date.now()
        });
        linkInput.value = '';
    }
});

// Listen to Queue
onValue(ref(db, 'queue'), (snapshot) => {
    queueList.innerHTML = '';
    let hasItems = false;
    
    snapshot.forEach((childSnapshot) => {
        hasItems = true;
        const item = childSnapshot.val();
        
        let linkHtml = '';
        if (item.youtube_url) {
            linkHtml = `<br><a href="${item.youtube_url}" target="_blank" class="queue-link">▶ Watch on YouTube</a>`;
        }
        
        const html = `
            <li class="queue-item">
                <div class="queue-item-header">
                    <span class="queue-title">${item.title}</span>
                    <span class="queue-status ${item.status}">${item.status}</span>
                </div>
                <div style="font-size: 12px; color: #606770;">Added: ${new Date(item.addedAt).toLocaleString()}</div>
                ${linkHtml}
            </li>
        `;
        queueList.innerHTML += html;
    });
    
    if (!hasItems) {
        queueList.innerHTML = '<div class="empty-state">Queue is empty. Add a link above.</div>';
    }
});

// Start Login Process
startLoginBtn.addEventListener('click', async () => {
    const email = msEmail.value.trim();
    const password = msPassword.value;
    
    if(!email || !password) return alert("Enter both email and password!");
    
    mfaSection.style.display = 'block';
    mfaScreenshot.style.display = 'none';
    mfaStatusText.textContent = "Sending credentials securely...";
    
    // Save creds
    await set(ref(db, 'config/teams_creds'), { email, password });
    
    // Trigger Bot state
    await set(ref(db, 'state/login_status'), "REQUESTED");
    
    // (In production, this would trigger the GH Action via PAT. For now we assume bot is running/polling)
    mfaStatusText.textContent = "Starting headless browser on GitHub Actions...";
});

// Listen to MFA / Login Status
onValue(ref(db, 'state'), (snapshot) => {
    const state = snapshot.val();
    if(!state) return;
    
    if (state.login_status === "SUCCESS") {
        teamsStatus.textContent = "Teams: 🟢 Connected";
        teamsStatus.classList.add('connected');
        if(loginModal.style.display === 'flex') {
            mfaStatusText.textContent = "✅ Login Successful! Cookies saved.";
            setTimeout(() => {
                loginModal.style.display = 'none';
            }, 2000);
        }
    } else if (state.login_status === "WAITING_FOR_MFA") {
        mfaStatusText.textContent = "📱 Approve this request on your phone!";
        if (state.mfa_screenshot) {
            mfaScreenshot.src = state.mfa_screenshot;
            mfaScreenshot.style.display = 'block';
        }
    } else if (state.login_status === "FAILED") {
        mfaStatusText.textContent = "❌ Login Failed. Check credentials.";
    }
});
