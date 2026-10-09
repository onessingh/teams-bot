import urllib.request
url = "https://api.github.com/repos/onessingh/teams-bot/actions/jobs/111190340901/logs"
req = urllib.request.Request(url)
try:
    with urllib.request.urlopen(req) as res:
        logs = res.read().decode()
    with open("job_logs.txt", "w", encoding="utf-8") as f:
        f.write(logs)
    print("Logs saved to job_logs.txt")
except Exception as e:
    print("Error:", e)
