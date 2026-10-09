import urllib.request, json
req = urllib.request.Request("https://api.github.com/repos/onessingh/teams-bot/actions/runs?per_page=1")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())
run_id = data['workflow_runs'][0]['id']
print("Run ID:", run_id)
jobs_url = data['workflow_runs'][0]['jobs_url']
req2 = urllib.request.Request(jobs_url)
with urllib.request.urlopen(req2) as res2:
    jobs_data = json.loads(res2.read().decode())
job_id = jobs_data['jobs'][0]['id']
print("Job ID:", job_id)
