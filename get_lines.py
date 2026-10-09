with open('dashboard/index.html', 'r', encoding='utf-8') as f:
    text = f.read()
lines = text.split('\n')
for i, line in enumerate(lines):
    if 'Add' in line and 'Class' in line:
        print('---')
        for j in range(max(0, i-5), min(len(lines), i+15)):
            print(f"{j}: {lines[j]}")
