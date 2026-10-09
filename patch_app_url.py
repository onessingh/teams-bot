with open("dashboard/app.js", "r", encoding="utf-8") as f:
    code = f.read()

target = "const url = liveLinkInput.value.trim();\n    if (!url) return alert('Please paste a valid Teams Live Meeting link!');"
replacement = """const url = liveLinkInput.value.trim();
    if (!url || (!url.startsWith('http://') && !url.startsWith('https://'))) {
        return alert('Please paste a valid Teams Live Meeting link starting with https://!');
    }"""

if target in code:
    code = code.replace(target, replacement)
    with open("dashboard/app.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Successfully patched dashboard/app.js with URL validation!")
else:
    print("ERR: target not found in app.js")
