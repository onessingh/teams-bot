import re

with open('bot/live-index.js', 'r', encoding='utf-8') as f:
    text = f.read()

start_idx = text.find('async function claimNextWaiting() {')
end_idx = text.find('async function getCookies(accountId) {')

if start_idx != -1 and end_idx != -1:
    new_func = '''async function claimNextWaiting() {
    const snap = await db.ref('live_queue').orderByChild('addedAt').once('value');
    let selected = null;
    const now = Date.now();
    snap.forEach(child => {
      const item = child.val() || {};
      if (!selected && item.status === 'WAITING' && item.url) {
        if (item.scheduledTime) {
            if (now >= item.scheduledTime - (15 * 60 * 1000)) {
                selected = { id: child.key, ...item };
            }
        } else {
            selected = { id: child.key, ...item };
        }
      }
    });
    if (!selected) return null;
  
    const itemRef = db.ref(live_queue/);
    const currentSnap = await itemRef.once('value');
    const current = currentSnap.val();
    
    if (current && current.status === 'WAITING') {
      await itemRef.update({ status: 'STARTING', startedAt: Date.now(), error: null, run_url: process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID ? 'https://github.com/' + process.env.GITHUB_REPOSITORY + '/actions/runs/' + process.env.GITHUB_RUN_ID : null });
      return selected;
    }
  
    return null;
}

'''
    text = text[:start_idx] + new_func + text[end_idx:]

with open('bot/live-index.js', 'w', encoding='utf-8') as f:
    f.write(text)
