with open("bot/live-index.js", "r", encoding="utf-8") as f:
    code = f.read()

target = "async function processItem(item) {\n  const ref = db.ref(`live_queue/${item.id}`);"
replacement = """async function processItem(item) {
  const ref = db.ref(`live_queue/${item.id}`);

  if (!item.url || typeof item.url !== 'string' || !item.url.startsWith('http')) {
    const errStr = `Invalid meeting URL: "${String(item.url).slice(0, 50)}..."`;
    console.error(`? Live Class: ${item.title || item.id} failed:`, errStr);
    await ref.update({ status: 'FAILED', error: errStr, updatedAt: Date.now() });
    return;
  }"""

if target in code:
    code = code.replace(target, replacement)
    with open("bot/live-index.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Successfully patched live-index.js with URL validation!")
else:
    print("ERR: target not found in live-index.js")
