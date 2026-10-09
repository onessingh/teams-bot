import re

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("          if (item.youtube_url) {",
                    "          if (item.run_url) {\n              linkHtml +=  <a href=\"\\" target=\"_blank\" class=\"mt-2 inline-flex items-center text-xs font-bold text-gray-700 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition-colors\">?? Download Backup</a>;\n          }\n          if (item.youtube_url) {")

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(text)
