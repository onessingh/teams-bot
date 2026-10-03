import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getDatabase, ref, push, onValue, set, remove } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-database.js";

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
const durationInput = document.getElementById('teams-duration');
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
    loginModal.classList.add('active');
});

closeModalBtn.addEventListener('click', () => {
    loginModal.classList.remove('active');
    mfaSection.classList.add('hidden');
});

// Add link to queue
addBtn.addEventListener('click', () => {
    const url = linkInput.value.trim();
    const durationMins = parseInt(durationInput.value) || 300; // default 5 hours
    const maxMs = durationMins * 60 * 1000;
    
    if(url) {
        push(ref(db, 'queue'), {
            title: "Class " + new Date().toLocaleString(),
            url: url,
            status: 'WAITING',
            maxMs: maxMs,
            addedAt: Date.now()
        });
        linkInput.value = '';
    }
});

// Handle Delete clicks
queueList.addEventListener('click', (e) => {
    if (e.target.closest('.delete-btn')) {
        const btn = e.target.closest('.delete-btn');
        const id = btn.getAttribute('data-id');
        if (confirm("Are you sure you want to delete this class?")) {
            remove(ref(db, `queue/${id}`));
        }
    }
});

// Helper for status colors
function getStatusColor(status) {
    if(status === 'COMPLETED') return 'text-green-600';
    if(status === 'RECORDING') return 'text-red-600 animate-pulse';
    if(status === 'UPLOADING') return 'text-amber-500';
    if(status === 'FAILED') return 'text-red-600';
    return 'text-blue-600';
}

// Listen to Queue
let queueItemsData = [];
onValue(ref(db, 'queue'), (snapshot) => {
    queueList.innerHTML = '';
    queueItemsData = [];
    let hasItems = false;
    
    snapshot.forEach((childSnapshot) => {
        hasItems = true;
        const item = childSnapshot.val();
        item.id = childSnapshot.key;
        queueItemsData.push(item);
        
        let linkHtml = '';
        if (item.youtube_url) {
            linkHtml = `<a href="${item.youtube_url}" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">▶️ Watch on YouTube</a>`;
        }
        
        let statusText = item.status;
        if (item.error) {
            linkHtml += `<div class="mt-2 text-[10px] text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100">${item.error}</div>`;
        }

        if (item.status === 'UPLOADING') {
            statusText = `UPLOADING (${item.upload_progress || 0}%)`;
        }
        
        const statusColor = getStatusColor(item.status);
        
        const html = `
            <li class="queue-item bg-white p-4 border border-gray-100 rounded-xl shadow-sm relative group">
                <button class="delete-btn absolute top-3 right-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider border border-red-200 transition-colors" data-id="${item.id}" title="Delete this item">
                    ❌ Delete
                </button>
                <div class="flex justify-between items-start mb-1 pr-16">
                    <span class="font-bold text-sm text-gray-800 truncate pr-2" title="${item.title}">${item.title}</span>
                </div>
                <div class="mb-1">
                    <span class="text-[11px] font-black uppercase tracking-wider ${statusColor} shrink-0" id="status-${item.id}">${statusText}</span>
                </div>
                <div class="text-[11px] text-gray-500 flex justify-between items-center pr-8">
                    <span>Added: ${new Date(item.addedAt).toLocaleString()}</span>
                    ${item.maxMs ? `<span class="bg-gray-100 px-2 py-0.5 rounded text-gray-600">⏳ ${(item.maxMs/60000).toFixed(0)}m limit</span>` : ''}
                </div>
                <div id="elapsed-${item.id}" class="text-xs font-bold text-red-600 mt-2 empty:hidden"></div>
                ${linkHtml}
            </li>
        `;
        queueList.innerHTML += html;
    });
    
    if (!hasItems) {
        queueList.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">Queue is empty. Add a link above.</div>';
    }
});

// Update elapsed time every second for recording items
setInterval(() => {
    queueItemsData.forEach(item => {
        const elapsedEl = document.getElementById(`elapsed-${item.id}`);
        if (elapsedEl && item.status === 'RECORDING' && item.updatedAt) {
            const diff = Date.now() - item.updatedAt;
            const hours = Math.floor(diff / 3600000);
            const mins = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
            const secs = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
            elapsedEl.textContent = `⏱️ Elapsed: ${hours > 0 ? hours + ':' : ''}${mins}:${secs}`;
        } else if (elapsedEl) {
            elapsedEl.textContent = '';
        }
    });
}, 1000);

// Start Login Process
startLoginBtn.addEventListener('click', async () => {
    const target = (document.getElementById('ms-account-key')?.value || 'teams_creds').trim();
    const email = msEmail.value.trim();
    const password = msPassword.value;
    
    if(!email || !password) return alert("Enter both email and password!");
    
    mfaSection.classList.remove('hidden');
    mfaScreenshot.classList.add('hidden');
    mfaStatusText.textContent = "Sending credentials securely...";
    mfaStatusText.className = "text-sm font-bold text-blue-600 mb-3 animate-pulse";
    
    // Save creds
    await set(ref(db, 'config/' + target), { email, password });
    await set(ref(db, 'state/login_target'), target);
    
    // Trigger Bot state
    await set(ref(db, 'state/login_status'), "REQUESTED");
    
    mfaStatusText.textContent = "Waiting for bot to login..."; triggerGhBtn.click();
});



// Listen to MFA / Login Status
onValue(ref(db, 'state'), (snapshot) => {
    const state = snapshot.val();
    if(!state) return;
    
    if (state.login_status === "SUCCESS") {
        teamsStatus.innerHTML = "Teams: <span class='text-green-500'>🟢 Connected</span>";
        teamsStatus.className = "px-3 py-1 rounded-full text-xs font-bold bg-green-50 border border-green-200 text-green-700";
        if(loginModal.classList.contains('active')) {
            mfaStatusText.textContent = "✅ Login Successful! Cookies saved.";
            mfaStatusText.className = "text-sm font-bold text-green-600 mb-3";
            setTimeout(() => {
                loginModal.classList.remove('active');
            }, 2000);
        }
    } else if (state.login_status === "WAITING_FOR_MFA") {
        mfaStatusText.textContent = "Approve this request on your phone!";
        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";
    } else if (state.login_status === "FAILED") {
        mfaStatusText.textContent = "Login Failed. See screenshot below.";
        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";
    }
    
    if (state.mfa_screenshot && (state.login_status === "WAITING_FOR_MFA" || state.login_status === "FAILED")) {
        mfaScreenshot.src = state.mfa_screenshot;
        mfaScreenshot.classList.remove('hidden');
    }
});

// GitHub Trigger Logic
const triggerGhBtn = document.getElementById('trigger-gh-btn');
const ghModal = document.getElementById('gh-modal');
const closeGhModalBtn = document.getElementById('close-gh-modal-btn');
const saveGhBtn = document.getElementById('save-gh-btn');
const clearGhBtn = document.getElementById('clear-gh-btn');
const ghTokenInput = document.getElementById('gh-token-input');
const ghStatusText = document.getElementById('gh-status-text');

function getGhToken() {
    return localStorage.getItem('teams_gh_pat');
}

triggerGhBtn.addEventListener('click', () => {
    const token = getGhToken();
    if (!token) {
        ghModal.classList.add('active');
        clearGhBtn.classList.add('hidden');
    } else {
        triggerGitHubAction(token);
    }
});

closeGhModalBtn.addEventListener('click', () => {
    ghModal.classList.remove('active');
    ghStatusText.textContent = '';
});

saveGhBtn.addEventListener('click', () => {
    const token = ghTokenInput.value.trim();
    if (!token) {
        ghStatusText.textContent = "Please enter a valid token.";
        ghStatusText.className = "text-sm font-bold text-red-600 mt-4 text-center";
        return;
    }
    localStorage.setItem('teams_gh_pat', token);
    ghStatusText.textContent = "Token saved! Starting bot...";
    ghStatusText.className = "text-sm font-bold text-green-600 mt-4 text-center";
    triggerGitHubAction(token);
});

clearGhBtn.addEventListener('click', () => {
    localStorage.removeItem('teams_gh_pat');
    ghTokenInput.value = '';
    clearGhBtn.classList.add('hidden');
    ghStatusText.textContent = "Token deleted from this phone.";
    ghStatusText.className = "text-sm font-bold text-amber-500 mt-4 text-center";
});

// Optionally let them open modal even if token exists by long-pressing
let pressTimer;
triggerGhBtn.addEventListener('touchstart', () => {
    pressTimer = window.setTimeout(() => {
        ghTokenInput.value = getGhToken() || '';
        if(getGhToken()) clearGhBtn.classList.remove('hidden');
        ghModal.classList.add('active');
    }, 1000);
});
triggerGhBtn.addEventListener('touchend', () => clearTimeout(pressTimer));

async function triggerGitHubAction(token) {
    const originalText = triggerGhBtn.innerHTML;
    triggerGhBtn.innerHTML = "⏳ Starting...";
    triggerGhBtn.disabled = true;
    
    try {
        const response = await fetch('https://api.github.com/repos/onessingh/teams-bot/actions/workflows/class-bot.yml/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github+json',
                'Authorization': `Bearer ${token}`,
                'X-GitHub-Api-Version': '2022-11-28'
            },
            body: JSON.stringify({ ref: 'main' })
        });

        if (response.ok) {
            triggerGhBtn.innerHTML = "✅ Bot Started!";
            triggerGhBtn.classList.replace('bg-indigo-600', 'bg-green-600');
            setTimeout(() => {
                ghModal.classList.remove('active');
            }, 1000);
        } else {
            const errData = await response.json();
            throw new Error(errData.message || 'Unknown error');
        }
    } catch (error) {
        if (error.message.includes('Bad credentials')) {
            alert("Token is invalid or expired. Please enter a new one.");
            localStorage.removeItem('teams_gh_pat');
            ghModal.classList.add('active');
        } else {
            alert("Failed to start bot: " + error.message);
        }
        triggerGhBtn.innerHTML = originalText;
    } finally {
        setTimeout(() => {
            triggerGhBtn.innerHTML = originalText;
            triggerGhBtn.classList.replace('bg-green-600', 'bg-indigo-600');
            triggerGhBtn.disabled = false;
        }, 3000);
    }
}





// UI TABS LOGIC
const tabVod = document.getElementById('tab-vod');
const tabLive = document.getElementById('tab-live');
const vodSection = document.getElementById('vod-section');
const liveSection = document.getElementById('live-section');

tabVod.addEventListener('click', () => {
    tabVod.className = "w-1/2 py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-600 transition-colors";
    tabLive.className = "w-1/2 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
    vodSection.classList.remove('hidden');
    liveSection.classList.add('hidden');
});

tabLive.addEventListener('click', () => {
    tabLive.className = "w-1/2 py-3 text-sm font-bold border-b-2 border-red-600 text-red-600 transition-colors";
    tabVod.className = "w-1/2 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors";
    liveSection.classList.remove('hidden');
    vodSection.classList.add('hidden');
});

// LIVE QUEUE LOGIC
const liveLinkInput = document.getElementById('live-link');
const liveAddBtn = document.getElementById('live-add-btn');
const liveAccountSelect = document.getElementById('live-account');
const liveQueueList = document.getElementById('live-queue-list');
const liveTriggerBtn = document.getElementById('live-trigger-gh-btn');

liveAddBtn.addEventListener('click', async () => {
    const url = liveLinkInput.value.trim();
    if (!url) return alert('Please paste a valid Teams Live Meeting link!');
    
    const timeStr = document.getElementById('live-schedule-time')?.value;
    let scheduledTime = 0;
    if (timeStr) scheduledTime = new Date(timeStr).getTime();
    
    liveAddBtn.disabled = true;
    liveAddBtn.innerText = 'Adding...';
    
    try {
        await push(ref(db, 'live_queue'), {
            url: url,
            title: 'Live Class: ' + new Date().toLocaleString(),
            status: 'WAITING',
            addedAt: Date.now(),
            scheduledTime: scheduledTime,
            accountId: liveAccountSelect.value
        });
        liveLinkInput.value = '';
        if (scheduledTime > 0 && typeof updateGitHubLiveCron === 'function') {
            await updateGitHubLiveCron();
        }
    } catch (e) {
        alert('Error: ' + e.message);
    }
    
    liveAddBtn.disabled = false;
    liveAddBtn.innerText = 'Add Live Class';
});

// Listen to Live Queue
let liveQueueItemsData = [];
onValue(ref(db, 'live_queue'), (snapshot) => {
    liveQueueList.innerHTML = '';
    liveQueueItemsData = [];
    let hasItems = false;
    
    snapshot.forEach((childSnapshot) => {
        hasItems = true;
        const item = childSnapshot.val();
        item.id = childSnapshot.key;
        liveQueueItemsData.push(item);
        
        let linkHtml = '';
        if (item.youtube_url) {
            linkHtml = `<a href="${item.youtube_url}" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors"> Watch on YouTube</a>`;
        }
        
        let statusText = item.status;
        if (item.error) {
            linkHtml += `<div class="mt-2 text-[10px] text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100">${item.error}</div>`;
        }
        if (item.status === 'UPLOADING') {
            statusText = `UPLOADING (${item.upload_progress || 0}%)`;
        }
        
        let statusColor = "bg-gray-100 text-gray-600";
        if (item.status === 'WAITING') statusColor = "bg-yellow-100 text-yellow-700";
        if (item.status === 'STARTING') statusColor = "bg-blue-100 text-blue-700";
        if (item.status === 'RECORDING') statusColor = "bg-red-100 text-red-700 animate-pulse";
        if (item.status === 'COMPLETED') statusColor = "bg-green-100 text-green-700";
        if (item.status === 'FAILED' || item.status === 'TEAMS_LOGIN_REQUIRED') statusColor = "bg-red-100 text-red-700";
        
        const html = `
            <li class="queue-item bg-white p-4 border border-gray-100 rounded-xl shadow-sm relative group">
                <button class="live-delete-btn absolute top-3 right-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider border border-red-200 transition-colors" data-id="${item.id}" title="Delete this item">
                    Delete
                </button>
                <div class="flex justify-between items-start mb-1 pr-16">
                    <span class="font-bold text-sm text-gray-800 truncate pr-2" title="${item.title}">${item.title}</span>
                </div>
                <div class="mb-1">
                    <span class="text-[11px] font-black uppercase tracking-wider ${statusColor} shrink-0">${statusText}</span>
                </div>
                <div class="text-[11px] text-gray-500 flex justify-between items-center pr-8">
                    <span>Added: ${new Date(item.addedAt).toLocaleString()}</span>
                </div>
                <div id="live-elapsed-${item.id}" class="text-xs font-bold text-red-600 mt-2 empty:hidden"></div>
                ${linkHtml}
            </li>
        `;
        liveQueueList.innerHTML += html;
    });
    
    if (!hasItems) {
        liveQueueList.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">No live classes scheduled.</div>';
    }
    
    document.querySelectorAll('.live-delete-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const id = e.target.getAttribute('data-id');
            if (confirm('Delete this live class from queue?')) {
                await remove(ref(db, 'live_queue/' + id));
            }
        });
    });
});

liveTriggerBtn.addEventListener('click', async () => {
    const token = localStorage.getItem('teams_gh_pat');
    if (!token) {
        // Open the github token modal if missing
        const ghModal = document.getElementById('gh-token-modal');
        const clearGhBtn = document.getElementById('clear-gh-btn');
        if(ghModal) ghModal.classList.add('active');
        if(clearGhBtn) clearGhBtn.classList.add('hidden');
        return;
    }

    const originalText = liveTriggerBtn.innerHTML;
    liveTriggerBtn.innerHTML = 'Starting Server...';
    liveTriggerBtn.disabled = true;
    
    try {
        const response = await fetch('https://api.github.com/repos/onessingh/teams-bot/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': 'token ' + token
            },
            body: JSON.stringify({
                event_type: 'start-live-processing'
            })
        });
        
        if (response.ok) {
            alert('Live Bot Cloud Server started successfully! It will join the meeting in ~2 minutes.');
        } else {
            alert('Failed to start Live Bot Server.');
        }
    } catch (e) {
        alert('Error starting Live Server: ' + e.message);
    }
    
    liveTriggerBtn.innerHTML = originalText;
    liveTriggerBtn.disabled = false;
});

// Also update live elapsed time
setInterval(() => {
    liveQueueItemsData.forEach(item => {
        const elapsedEl = document.getElementById(`live-elapsed-${item.id}`);
        if (elapsedEl && item.status === 'RECORDING' && item.updatedAt) {
            const diff = Date.now() - item.updatedAt;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            elapsedEl.innerText = `Recording: ${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    });
}, 1000);


// Populate Live Accounts Dropdown
onValue(ref(db, 'config'), (snap) => {
    const config = snap.val();
    const sel = document.getElementById('live-account');
    if (sel && config) {
        sel.innerHTML = '';
        Object.keys(config).forEach(k => {
            if (config[k] && config[k].email) {
                sel.innerHTML += `<option value="${k}">${k} (${config[k].email})</option>`;
            }
        });
        if (sel.innerHTML === '') {
            sel.innerHTML = '<option value="teams_creds">Default Account</option>';
        }
    }
});

async function updateGitHubLiveCron() {
    try {
        const snap = await get(ref(db, 'live_queue'));
        const queue = snap.val() || {};
        const crons = [];
        Object.values(queue).forEach(item => {
            if (item.status === 'WAITING' && item.scheduledTime) {
                const d = new Date(item.scheduledTime - 15 * 60 * 1000);
                const cronStr = `${d.getUTCMinutes()} ${d.getUTCHours()} ${d.getUTCDate()} ${d.getUTCMonth() + 1} *`;
                if (!crons.includes(cronStr)) crons.push(cronStr);
            }
        });
        
        if (crons.length === 0) return;
        
        let cronYaml = crons.map(c => `    - cron: '${c}'`).join('\n');
        
        const yamlContent = `name: Live Schedule Runner\n\non:\n  schedule:\n${cronYaml}\n\njobs:\n  process-live:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Trigger Dispatch\n        uses: peter-evans/repository-dispatch@v3\n        with:\n          token: \${{ secrets.GITHUB_TOKEN }}\n          event-type: start-live-processing\n`;

        const url = 'https://api.github.com/repos/onessingh/teams-bot/contents/.github/workflows/live-bot.yml';
        const headers = { 'Authorization': 'token ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' };
        
        let sha = null;
        let content = '';
        try {
            const getRes = await fetch(url, { headers });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
                content = atob(data.content);
            }
        } catch(e) {}
        
        if (!content) return;
        
        // Remove existing schedule block if any
        content = content.replace(/\\n\\s*schedule:\\n(\\s*- cron: .*\\n)+/, '');
        
        // Inject new schedule block
        const scheduleBlock = `\n  schedule:\n${cronYaml}`;
        content = content.replace('on:\n', 'on:' + scheduleBlock + '\n');
        
        const body = {
            message: 'Update dynamic live schedule',
            content: btoa(content),
            sha: sha
        };
        
        await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
        console.log('GitHub Cron updated with', crons.length, 'schedules.');
    } catch(e) {
        console.error('Failed to update GH cron', e);
    }
}


