import urllib.request, json
req = urllib.request.Request("https://teams-class-bot-default-rtdb.firebaseio.com/queue.json")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())
    if not data:
        print("Queue is empty")
    else:
        for k, v in data.items():
            if v.get('status') in ['TEAMS_LOGIN_REQUIRED', 'WAITING_FOR_MFA', 'ERROR'] or v.get('accountId') == 'default':
                print(f"Fixing item {k} (Title: {v.get('title')})")
                patch_data = {"status": "WAITING", "error": None}
                if v.get('accountId') == 'default' or not v.get('accountId'):
                    patch_data["accountId"] = "Raj Singh"
                req_patch = urllib.request.Request(f"https://teams-class-bot-default-rtdb.firebaseio.com/queue/{k}.json", data=json.dumps(patch_data).encode('utf-8'), method='PATCH')
                req_patch.add_header('Content-Type', 'application/json')
                urllib.request.urlopen(req_patch)

req_live = urllib.request.Request("https://teams-class-bot-default-rtdb.firebaseio.com/live_queue.json")
with urllib.request.urlopen(req_live) as res:
    data = json.loads(res.read().decode())
    if not data:
        print("Live queue is empty")
    else:
        for k, v in data.items():
            if v.get('status') in ['ERROR', 'FAILED']:
                print(f"Fixing live item {k} (Title: {v.get('title')})")
                req_patch = urllib.request.Request(f"https://teams-class-bot-default-rtdb.firebaseio.com/live_queue/{k}.json", data=json.dumps({"status": "WAITING", "error": None}).encode('utf-8'), method='PATCH')
                req_patch.add_header('Content-Type', 'application/json')
                urllib.request.urlopen(req_patch)
