import sys

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    js = f.read()

appends = '''
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
    
    liveAddBtn.disabled = true;
    liveAddBtn.innerText = 'Adding...';
    
    try {
        await push(ref(db, 'live_queue'), {
            url: url,
            title: 'Live Class: ' + new Date().toLocaleString(),
            status: 'WAITING',
            addedAt: Date.now(),
            accountId: liveAccountSelect.value
        });
        liveLinkInput.value = '';
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
            linkHtml = \<a href="\" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">?? Watch on YouTube</a>\;
        }
        
        let statusText = item.status;
        if (item.error) {
            linkHtml += \<div class="mt-2 text-[10px] text-red-500 font-medium bg-red-50 p-2 rounded border border-red-100">\</div>\;
        }
        if (item.status === 'UPLOADING') {
            statusText = \UPLOADING (\%)\;
        }
        
        let statusColor = "bg-gray-100 text-gray-600";
        if (item.status === 'WAITING') statusColor = "bg-yellow-100 text-yellow-700";
        if (item.status === 'STARTING') statusColor = "bg-blue-100 text-blue-700";
        if (item.status === 'RECORDING') statusColor = "bg-red-100 text-red-700 animate-pulse";
        if (item.status === 'COMPLETED') statusColor = "bg-green-100 text-green-700";
        if (item.status === 'FAILED' || item.status === 'TEAMS_LOGIN_REQUIRED') statusColor = "bg-red-100 text-red-700";
        
        const html = \
            <li class="queue-item bg-white p-4 border border-gray-100 rounded-xl shadow-sm relative group">
                <button class="live-delete-btn absolute top-3 right-3 text-red-600 font-bold bg-red-50 hover:bg-red-100 px-3 py-1 rounded-lg text-[10px] uppercase tracking-wider border border-red-200 transition-colors" data-id="\" title="Delete this item">
                    ??? Delete
                </button>
                <div class="flex justify-between items-start mb-1 pr-16">
                    <span class="font-bold text-sm text-gray-800 truncate pr-2" title="\">\</span>
                </div>
                <div class="mb-1">
                    <span class="text-[11px] font-black uppercase tracking-wider \ shrink-0">\</span>
                </div>
                <div class="text-[11px] text-gray-500 flex justify-between items-center pr-8">
                    <span>Added: \</span>
                </div>
                <div id="live-elapsed-\" class="text-xs font-bold text-red-600 mt-2 empty:hidden"></div>
                \
            </li>
        \;
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
    const originalText = liveTriggerBtn.innerHTML;
    liveTriggerBtn.innerHTML = 'Starting Server...';
    liveTriggerBtn.disabled = true;
    
    try {
        const response = await fetch('https://api.github.com/repos/onessingh/teams-bot/dispatches', {
            method: 'POST',
            headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': 'token ' + GITHUB_TOKEN
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
        const elapsedEl = document.getElementById(\live-elapsed-\\);
        if (elapsedEl && item.status === 'RECORDING' && item.updatedAt) {
            const diff = Date.now() - item.updatedAt;
            const hours = Math.floor(diff / 3600000);
            const minutes = Math.floor((diff % 3600000) / 60000);
            const seconds = Math.floor((diff % 60000) / 1000);
            elapsedEl.innerText = \Recording: \:\:\\;
        }
    });
}, 1000);
'''

with open('dashboard/app.js', 'a', encoding='utf-8') as f:
    f.write(appends)
print("Done appending to app.js")

