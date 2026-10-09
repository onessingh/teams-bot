import re

with open('bot/youtube.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the broken template literals manually
text = text.replace("console.log([YouTube] Trying upload using ...);", "console.log(`[YouTube] Trying upload using ${cred.name}...`);")
text = text.replace("console.log([YouTube] Looking for playlist:  on );", "console.log(`[YouTube] Looking for playlist: ${playlistTitle} on ${cred.name}`);")
text = text.replace("console.log([YouTube] Playlist not found. Creating new playlist: );", "console.log(`[YouTube] Playlist not found. Creating new playlist: ${playlistTitle}`);")
text = text.replace("const finalTitle = ` - Class  - `;", "const finalTitle = `${playlistTitle} - Class ${classNum} - ${dateStr}`;")
text = text.replace("console.log([YouTube] Generated Video Title: );", "console.log(`[YouTube] Generated Video Title: ${finalTitle}`);")
text = text.replace("const youtubeUrl = `https://youtu.be/`;", "const youtubeUrl = `https://youtu.be/${videoId}`;")
text = text.replace("console.log([YouTube] Upload complete! Video URL: );", "console.log(`[YouTube] Upload complete! Video URL: ${youtubeUrl}`);")
text = text.replace("console.log([YouTube] Adding video to playlist ...);", "console.log(`[YouTube] Adding video to playlist ${playlistTitle}...`);")
text = text.replace("console.error(`[YouTube] Error with :`, e.message);", "console.error(`[YouTube] Error with ${cred.name}:`, e.message);")
text = text.replace("console.log(`[YouTube] Quota exceeded on , switching to next account...`);", "console.log(`[YouTube] Quota exceeded on ${cred.name}, switching to next account...`);")
text = text.replace("throw new Error(`All YouTube accounts failed. Last error: `);", "throw new Error(`All YouTube accounts failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);")

with open('bot/youtube.js', 'w', encoding='utf-8') as f:
    f.write(text)
