import re

with open('dashboard/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

# Replace VOD
text = text.replace('class="flex-[2] px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"',
                    'class="flex-[2] min-w-0 truncate px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white text-ellipsis"')

# Replace Live
text = text.replace('class="flex-[2] px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"',
                    'class="flex-[2] min-w-0 truncate px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white text-ellipsis"')

# Add min-w-0 to semester too to be safe
text = text.replace('class="flex-1 px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"',
                    'class="flex-1 min-w-0 truncate px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 outline-none text-sm bg-white"')
                    
text = text.replace('class="flex-1 px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"',
                    'class="flex-1 min-w-0 truncate px-4 py-3 rounded-lg border border-red-300 focus:ring-2 focus:ring-red-500 outline-none text-sm bg-white"')

with open('dashboard/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
