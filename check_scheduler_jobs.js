const https = require('https');

const options = {
  hostname: 'api.github.com',
  path: '/repos/onessingh/teams-bot/actions/workflows/scheduler.yml/runs?per_page=5',
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
      if (parsed.workflow_runs && parsed.workflow_runs.length > 0) {
        const runId = parsed.workflow_runs[0].id;
        console.log(`Latest scheduler run ID: ${runId}`);
        // To get logs we need to download them, which might be tricky, let's just see jobs first
        const opt2 = {
          hostname: 'api.github.com',
          path: `/repos/onessingh/teams-bot/actions/runs/${runId}/jobs`,
          method: 'GET',
          headers: {
            'User-Agent': 'Node.js',
            'Accept': 'application/vnd.github.v3+json'
          }
        };
        const req2 = https.request(opt2, res2 => {
          let data2 = '';
          res2.on('data', d => data2 += d);
          res2.on('end', () => {
            const jobs = JSON.parse(data2);
            jobs.jobs.forEach(j => {
                console.log(`Job: ${j.name}, Status: ${j.status}, Conclusion: ${j.conclusion}`);
            });
          });
        });
        req2.end();
      }
    } catch(e) {}
  });
});
req.end();
