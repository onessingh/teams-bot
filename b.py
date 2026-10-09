import re, time
with open('dashboard/index.html', 'r', encoding='utf-8') as f:
    html = f.read()
html = re.sub(r'<script type="module" src="app\.js\?v=\d+"></script>', f'<script type="module" src="app.js?v={int(time.time())}"></script>', html)
with open('dashboard/index.html', 'w', encoding='utf-8') as f:
    f.write(html)
