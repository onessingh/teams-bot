const https = require('https');
const token = process.env.GH_SCHEDULER_TOKEN;

const options = {
  hostname: 'api.github.com',
  path: '/repos/onessingh/teams-bot/actions/runs?per_page=5',
  method: 'GET',
  headers: {
    'User-Agent': 'Node.js',
    'Accept': 'application/vnd.github.v3+json'
  }
};

const req = https.request(options, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const parsed = JSON.parse(data);
      if (parsed.workflow_runs) {
        parsed.workflow_runs.forEach(r => {
          console.log(`[${r.name}] Status: ${r.status}, Conclusion: ${r.conclusion}, Created: ${r.created_at}`);
        });
      } else {
        console.log('No runs found or bad token', parsed);
      }
    } catch(e) {
      console.log('Parse error', e);
    }
  });
});
req.end();
