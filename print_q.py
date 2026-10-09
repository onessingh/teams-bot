import urllib.request, json
req = urllib.request.Request("https://teams-class-bot-default-rtdb.firebaseio.com/queue.json")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())
    print(json.dumps(data, indent=2))
