const fs = require('fs');
let js = fs.readFileSync('dashboard/app.js', 'utf8');

js = js.replace("const url = liveLinkInput.value.trim();", "const url = liveLinkInput.value.trim();\n    const timeStr = document.getElementById('live-schedule-time')?.value;\n    let scheduledTime = 0;\n    if(timeStr) scheduledTime = new Date(timeStr).getTime();");
js = js.replace("addedAt: Date.now(),", "addedAt: Date.now(),\n            scheduledTime: scheduledTime,");

const injection = 
async function updateGitHubLiveCron() {
    try {
        const snap = await get(ref(db, 'live_queue'));
        const queue = snap.val() || {};
        const crons = [];
        Object.values(queue).forEach(item => {
            if (item.status === 'WAITING' && item.scheduledTime) {
                const d = new Date(item.scheduledTime - 15 * 60 * 1000);
                const cronStr = \\ \ \ \ *\;
                if(!crons.includes(cronStr)) crons.push(cronStr);
            }
        });
        
        if(crons.length === 0) return;
        
        let cronYaml = crons.map(c => \    - cron: '\'\).join('\\n');
        
        const yamlContent = \
ame: Live Schedule Runner\\n\\non:\\n  schedule:\\n\\\n\\njobs:\\n  process-live:\\n    runs-on: ubuntu-latest\\n    steps:\\n      - name: Trigger Dispatch\\n        uses: peter-evans/repository-dispatch@v3\\n        with:\\n          token: \\\n          event-type: start-live-processing\\n\;

        const url = 'https://api.github.com/repos/onessingh/teams-bot/contents/.github/workflows/live-schedule.yml';
        const headers = { 'Authorization': 'token ' + GITHUB_TOKEN, 'Accept': 'application/vnd.github.v3+json' };
        
        let sha = null;
        try {
            const getRes = await fetch(url, { headers });
            if (getRes.ok) {
                const data = await getRes.json();
                sha = data.sha;
            }
        } catch(e) {}
        
        const body = {
            message: 'Update dynamic live schedule',
            content: btoa(yamlContent)
        };
        if(sha) body.sha = sha;
        
        await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
        console.log('GitHub Cron updated!');
    } catch(e) {}
}
;

js = js.replace("liveLinkInput.value = '';", "liveLinkInput.value = '';\n        if(scheduledTime > 0) updateGitHubLiveCron();");
fs.writeFileSync('dashboard/app.js', injection + js);
