const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// The UI says "Auto-triggering now..." because window.autoTriggerFired is set to true and NOT reset,
// because in the block where the fetch fails (since there is no token), it was resetting autoTriggerFired
// but I commented out the WHOLE else block logic or modified it badly.

// Let's completely strip out the frontend auto-trigger loop!
// The frontend should NOT be responsible for triggering at all anymore.
// We have a fully functional backend cron for that.
// The code `setInterval(checkAutoTrigger, 1000)` should be removed.

const fixWarning = `
function updateLiveQueueUI() {
    liveQueueList.innerHTML = '';
    const now = new Date().getTime();
    let hasItems = false;

    for (const [key, item] of Object.entries(liveQueue)) {
        hasItems = true;
        const scheduledTime = new Date(item.scheduledTime).getTime();
        const timeDiff = scheduledTime - now;

        let statusColor = "bg-yellow-100 text-yellow-700";
        let friendlyStatus = "WAITING";
        
        if (item.status === 'STARTING_BROWSER' || item.status === 'OPENING_RECORDING') statusColor = "bg-purple-100 text-purple-700";
        if (item.status === 'WAITING_FOR_SCHEDULED_TIME') { statusColor = "bg-blue-100 text-blue-700 animate-pulse"; friendlyStatus = "JOINED EARLY - WAITING"; }
        if (item.status === 'WAITING_IN_LOBBY') { statusColor = "bg-orange-100 text-orange-700 animate-pulse"; friendlyStatus = "WAITING IN LOBBY"; }
        if (item.status === 'ADMITTED_PREPARING_UI') { statusColor = "bg-indigo-100 text-indigo-700"; friendlyStatus = "ADMITTED - PREPARING UI"; }
        if (item.status === 'RECORDING') statusColor = "bg-red-100 text-red-700 animate-pulse";
        if (item.status === 'UPLOADING') statusColor = "bg-blue-100 text-blue-700 animate-pulse";
        if (item.status === 'FINISHED') statusColor = "bg-green-100 text-green-700";
        if (item.status === 'ERROR' || item.status === 'MEETING_ENDED') statusColor = "bg-red-100 text-red-700";

        if (item.status !== 'WAITING') {
            friendlyStatus = item.status.replace(/_/g, ' ');
        }

        const li = document.createElement('li');
        li.className = "bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-2";
        li.innerHTML = \`
            <div class="flex justify-between items-start">
                <div>
                    <div class="font-bold text-gray-800 text-sm">Live Class: \${new Date(item.scheduledTime).toLocaleString()}</div>
                    <div class="mt-1">
                        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full \${statusColor}">\${friendlyStatus}</span>
                    </div>
                </div>
                <button onclick="deleteLiveClass('\${key}')" class="text-xs text-red-500 hover:text-red-700 font-bold bg-red-50 px-2 py-1 rounded">DELETE</button>
            </div>
            <div class="text-xs text-gray-500 mt-1">
                Scheduled: \${new Date(item.scheduledTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div id="elapsed-\${key}" class="text-xs font-mono text-gray-600"></div>
        \`;
        liveQueueList.appendChild(li);
    }
    
    if (!hasItems) {
        liveQueueList.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">No live classes scheduled.</div>';
    }
}
`;

// Replace `updateLiveQueueUI`
appJs = appJs.replace(/function updateLiveQueueUI\(\) \{[\s\S]*?if \(!hasItems\) \{[\s\S]*?\}[\s\S]*?\}/, fixWarning);

// Let's remove the `checkAutoTrigger` function entirely and the setInterval
const removeCheckAutoTrigger = `
setInterval(() => {
    const now = new Date().getTime();
    for (const [key, item] of Object.entries(liveQueue)) {
        const elapsedDiv = document.getElementById('elapsed-' + key);
        if (!elapsedDiv) continue;

        if (item.status === 'RECORDING') {
            const startMs = item.recordingStartTime || now;
            const ms = now - startMs;
            const mins = Math.floor(ms / 60000);
            const secs = Math.floor((ms % 60000) / 1000);
            elapsedDiv.innerText = \`?? Elapsed: \${mins}m \${secs}s\`;
        } else if (item.status === 'WAITING' || item.status === 'STARTING_BROWSER' || item.status === 'OPENING_RECORDING') {
            const sch = new Date(item.scheduledTime).getTime();
            if (now < sch) {
                const ms = sch - now;
                const mins = Math.floor(ms / 60000);
                const secs = Math.floor((ms % 60000) / 1000);
                elapsedDiv.innerText = \`? Starts in: \${mins}m \${secs}s\`;
            } else {
                elapsedDiv.innerText = \`? Class is starting or scheduled time has passed.\`;
            }
        }
    }
}, 1000);
`;

// Replace everything after initAuth() with just the elapsed loop
appJs = appJs.replace(/async function checkAutoTrigger\(\) \{[\s\S]*setInterval\(checkAutoTrigger, 1000\);[\s\S]*setInterval\(\(\) => \{[\s\S]*?\}, 1000\);/, removeCheckAutoTrigger);

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Removed auto trigger logic completely.');
