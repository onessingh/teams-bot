import urllib.request, json
req_patch = urllib.request.Request("https://teams-class-bot-default-rtdb.firebaseio.com/queue/-P30nYNYI5pBDf78Vepa.json", data=json.dumps({"status": "WAITING", "error": None}).encode('utf-8'), method='PATCH')
req_patch.add_header('Content-Type', 'application/json')
urllib.request.urlopen(req_patch)
print("Reset queue item to WAITING")
