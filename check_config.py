import urllib.request, json
req = urllib.request.Request("https://teams-class-bot-default-rtdb.firebaseio.com/config.json")
with urllib.request.urlopen(req) as res:
    data = json.loads(res.read().decode())
    for k, v in data.items():
        if k == 'teams_cookies': continue
        if isinstance(v, list):
            print(f"Key: {k}, type: array, len: {len(v)}")
        elif isinstance(v, dict):
            print(f"Key: {k}, type: dict, keys: {list(v.keys())}")
        else:
            print(f"Key: {k}")
