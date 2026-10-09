import re

with open('dashboard/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace VOD
vod_selects = '''                <div class="flex gap-2">
                    <select id="vod-semester" class="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                        <option value="">-- Select Semester --</option>
                        <option value="1">Semester 1</option>
                        <option value="2">Semester 2</option>
                        <option value="3">Semester 3</option>
                        <option value="4">Semester 4</option>
                    </select>
                    <select id="vod-subject" class="flex-[2] px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white">
                        <option value="">-- Select Subject --</option>
                    </select>
                </div>'''

text = text.replace('class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">\n                \n                <div class="flex gap-2">',
'class="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-sm">\n                \n' + vod_selects + '\n                <div class="flex gap-2 mt-2">')

# Replace Live
live_selects = '''                <div class="flex gap-2">
                    <select id="live-semester" class="flex-1 px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
                        <option value="">-- Select Semester --</option>
                        <option value="1">Semester 1</option>
                        <option value="2">Semester 2</option>
                        <option value="3">Semester 3</option>
                        <option value="4">Semester 4</option>
                    </select>
                    <select id="live-subject" class="flex-[2] px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white">
                        <option value="">-- Select Subject --</option>
                    </select>
                </div>'''

text = text.replace('class="w-full px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm">\n                \n                <div class="flex gap-2">',
'class="w-full px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all text-sm">\n                \n' + live_selects + '\n                <div class="flex gap-2 mt-2">')

with open('dashboard/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
