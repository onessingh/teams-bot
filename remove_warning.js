const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// Remove the logic that shows the "No GitHub token!" error
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
        \`;
        liveQueueList.appendChild(li);
    }
    
    if (!hasItems) {
        liveQueueList.innerHTML = '<div class="text-center text-gray-400 py-8 text-sm">No live classes scheduled.</div>';
    }
}
`;

// Replace the entire updateLiveQueueUI function safely
appJs = appJs.replace(/function updateLiveQueueUI\(\) \{[\s\S]*?if \(!hasItems\) \{[\s\S]*?\}[\s\S]*?\}/, fixWarning);

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Removed token warning from UI');
