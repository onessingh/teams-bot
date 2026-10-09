import re
import os

for file in ['.github/workflows/class-bot.yml']:
    if not os.path.exists(file):
        continue
    with open(file, 'r', encoding='utf-8') as f:
        text = f.read()
    
    if 'YOUTUBE_CLIENT_ID_2' not in text:
        text = text.replace('YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}', 
'''YOUTUBE_REFRESH_TOKEN: ${{ secrets.YOUTUBE_REFRESH_TOKEN }}
          YOUTUBE_CLIENT_ID_2: ${{ secrets.YOUTUBE_CLIENT_ID_2 }}
          YOUTUBE_CLIENT_SECRET_2: ${{ secrets.YOUTUBE_CLIENT_SECRET_2 }}
          YOUTUBE_REFRESH_TOKEN_2: ${{ secrets.YOUTUBE_REFRESH_TOKEN_2 }}
          YOUTUBE_CLIENT_ID_3: ${{ secrets.YOUTUBE_CLIENT_ID_3 }}
          YOUTUBE_CLIENT_SECRET_3: ${{ secrets.YOUTUBE_CLIENT_SECRET_3 }}
          YOUTUBE_REFRESH_TOKEN_3: ${{ secrets.YOUTUBE_REFRESH_TOKEN_3 }}''')
        
        with open(file, 'w', encoding='utf-8') as f:
            f.write(text)
