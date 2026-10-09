import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

old_link_html = '''        if (item.youtube_url) {
            linkHtml = <a href="" target="_blank" class="mt-2 inline-flex items-center text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors">?? Watch on YouTube</a>;
        }'''

# Note: The emojis in the output showed some garbled text for Watch on YouTube, I will use standard emojis.
# Actually, I'll just regex replace it to be safe.
