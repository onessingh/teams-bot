with open('dashboard/index.html', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('<div class="flex-1 relative">\n                    <div class="flex-1 relative max-w-[120px]">', '<div class="flex-1 relative max-w-[120px]">')

with open('dashboard/index.html', 'w', encoding='utf-8') as f:
    f.write(text)
