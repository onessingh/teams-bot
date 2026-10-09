import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

# For VOD queue
old_vod = '''        if (item.youtube_url) {
            linkHtml = <a href="\\" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">?? Watch on YouTube</a>;
        }'''
new_vod = '''        if (item.youtube_url) {
            linkHtml += <a href="\\" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors mr-2">?? Watch on YouTube</a>;
        }
        if (item.run_url) {
            linkHtml += <a href="\\" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors">?? Download Backup</a>;
        }'''
# Due to garbled emoji in VOD queue, I will just use regex to replace after if (item.youtube_url) {

import sys
text = re.sub(r'(if \(item\.youtube_url\) \{[\s\S]*?\})', r'\1\n        if (item.run_url) {\n            linkHtml +=  <a href="" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors">?? Download Backup</a>;\n        }', text)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
