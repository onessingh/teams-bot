const fs = require('fs');
let html = fs.readFileSync('dashboard/index.html', 'utf8');
const start = html.indexOf('<!-- Input Section -->');
const end = html.indexOf('<!-- Login Modal -->');
if (start !== -1 && end !== -1) {
    const newHtml = 
        <!-- Tabs -->
        <div class="flex border-b border-gray-200 mb-6">
            <button id="tab-vod" class="w-1/2 py-3 text-sm font-bold border-b-2 border-blue-600 text-blue-600 transition-colors">?? Recorded Classes</button>
            <button id="tab-live" class="w-1/2 py-3 text-sm font-bold border-b-2 border-transparent text-gray-500 hover:text-gray-700 transition-colors">?? Live Classes</button>
        </div>

        <div id="vod-section">
            <!-- Input Section -->
            <div class="flex flex-col gap-3 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-100">
                <input type="text" id="teams-link" placeholder="Paste Teams recording link here..." 
                    class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">
                
                <div class="flex gap-2">
                    <div class="flex-1 relative">
                        <input type="number" id="teams-duration" placeholder="Duration" value="300"
                            class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">
                        <span class="absolute right-3 top-3 text-xs text-gray-400 pointer-events-none mt-0.5">mins</span>
                    </div>
                    <button id="add-btn" class="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm">
                        Add to Queue
                    </button>
                </div>
            </div>

            <!-- Queue Section -->
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider">Processing Queue</h2>
                    <button id="trigger-gh-btn" class="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1">
                        ?? Start Cloud Bot
                    </button>
                </div>
                <ul id="queue-list" class="flex flex-col gap-3">
                    <div class="text-center text-gray-400 py-8 text-sm">Queue is empty.</div>
                </ul>
            </div>
        </div>

        <div id="live-section" class="hidden">
            <!-- Live Input Section -->
            <div class="flex flex-col gap-3 mb-6 bg-red-50 p-4 rounded-xl border border-red-100">
                <input type="text" id="live-link" placeholder="Paste Live Meeting link (meetup-join) here..." 
                    class="w-full px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm">
                
                <div class="flex gap-2">
                    <div class="flex-1 relative">
                        <select id="live-account" class="w-full px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none transition-all text-sm bg-white text-gray-700 appearance-none">
                            <option value="default">Default Account</option>
                        </select>
                    </div>
                    <button id="live-add-btn" class="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 rounded-lg text-sm font-bold transition-colors shadow-sm">
                        Add Live Class
                    </button>
                </div>
            </div>

            <!-- Live Queue Section -->
            <div>
                <div class="flex justify-between items-center mb-3">
                    <h2 class="text-sm font-bold text-gray-400 uppercase tracking-wider">Live Queue</h2>
                    <button id="live-trigger-gh-btn" class="bg-red-600 hover:bg-red-700 text-white px-4 py-1.5 rounded-lg text-xs font-bold transition-colors shadow-sm flex items-center gap-1">
                        ?? Start Live Bot
                    </button>
                </div>
                <ul id="live-queue-list" class="flex flex-col gap-3">
                    <div class="text-center text-gray-400 py-8 text-sm">No live classes scheduled.</div>
                </ul>
            </div>
        </div>
    </div>

    ;
    fs.writeFileSync('dashboard/index.html', html.substring(0, start) + newHtml + html.substring(end));
}
