import json
import urllib.request

url_get = "https://teams-class-bot-default-rtdb.firebaseio.com/config/teams_cookies.json"
req = urllib.request.Request(url_get)
with urllib.request.urlopen(req) as response:
    cookies = json.loads(response.read().decode())

url_put = "https://teams-class-bot-default-rtdb.firebaseio.com/config/Raj%20Singh/cookies.json"
req_put = urllib.request.Request(url_put, data=json.dumps(cookies).encode('utf-8'), method='PUT')
req_put.add_header('Content-Type', 'application/json')
with urllib.request.urlopen(req_put) as response:
    print("Fixed via python!")
