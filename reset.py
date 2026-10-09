import urllib.request, json
url_patch = "https://teams-class-bot-default-rtdb.firebaseio.com/live_queue/-P30VSNTMSiSoL2uvO3-.json"
req_patch = urllib.request.Request(url_patch, data=json.dumps({"status": "WAITING", "error": None}).encode('utf-8'), method='PATCH')
req_patch.add_header('Content-Type', 'application/json')
with urllib.request.urlopen(req_patch) as res:
    print("Reset status to WAITING again")
