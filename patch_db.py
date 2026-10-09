import urllib.request, json
url = "https://teams-class-bot-default-rtdb.firebaseio.com/queue/-P30nYNYI5pBDf78Vepa.json"
req_patch = urllib.request.Request(url, data=json.dumps({"accountId": "Raj Singh"}).encode('utf-8'), method='PATCH')
req_patch.add_header('Content-Type', 'application/json')
urllib.request.urlopen(req_patch)
print("Patched queue item with accountId")
