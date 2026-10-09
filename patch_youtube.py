import re

with open('bot/youtube.js', 'r', encoding='utf-8') as f:
    text = f.read()

# Locate the entire uploadToYouTube function content
start_idx = text.find("async function uploadToYouTube(videoPath, subject, onProgress) {")
if start_idx != -1:
    old_func = text[start_idx:]
    
    new_func = '''async function uploadToYouTube(videoPath, subject, onProgress) {
    const creds = [
        { id: process.env.YOUTUBE_CLIENT_ID, sec: process.env.YOUTUBE_CLIENT_SECRET, token: process.env.YOUTUBE_REFRESH_TOKEN, name: "Account 1" },
        { id: process.env.YOUTUBE_CLIENT_ID_2, sec: process.env.YOUTUBE_CLIENT_SECRET_2, token: process.env.YOUTUBE_REFRESH_TOKEN_2, name: "Account 2" },
        { id: process.env.YOUTUBE_CLIENT_ID_3, sec: process.env.YOUTUBE_CLIENT_SECRET_3, token: process.env.YOUTUBE_REFRESH_TOKEN_3, name: "Account 3" }
    ].filter(c => c.id && c.sec && c.token);

    if (creds.length === 0) {
        throw new Error("No YouTube credentials found in environment variables.");
    }

    let lastError = null;
    let finalUrl = null;

    for (const cred of creds) {
        console.log([YouTube] Trying upload using ...);
        
        try {
            const oauth2Client = new google.auth.OAuth2(cred.id, cred.sec);
            oauth2Client.setCredentials({ refresh_token: cred.token });
            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
            
            let playlistId = null;
            let itemCount = 0;
            const playlistTitle = subject ? subject.trim() : 'Teams Classes';

            console.log([YouTube] Looking for playlist:  on );
            
            // 1. Search for existing playlist
            let nextPageToken = null;
            let found = false;
            
            do {
                const playlistRes = await youtube.playlists.list({
                    part: 'snippet,contentDetails',
                    mine: true,
                    maxResults: 50,
                    pageToken: nextPageToken
                });
                
                if (playlistRes.data.items) {
                    for (const item of playlistRes.data.items) {
                        if (item.snippet.title.toLowerCase() === playlistTitle.toLowerCase()) {
                            playlistId = item.id;
                            itemCount = item.contentDetails.itemCount || 0;
                            found = true;
                            break;
                        }
                    }
                }
                
                if (found) break;
                nextPageToken = playlistRes.data.nextPageToken;
            } while (nextPageToken);
            
            // 2. Create if not exists
            if (!playlistId) {
                console.log([YouTube] Playlist not found. Creating new playlist: );
                const createRes = await youtube.playlists.insert({
                    part: 'snippet,status',
                    requestBody: {
                        snippet: { title: playlistTitle, description: 'Automated Class Recordings' },
                        status: { privacyStatus: 'unlisted' }
                    }
                });
                playlistId = createRes.data.id;
                itemCount = 0;
            }

            // 3. Formulate Title
            const dateStr = new Date().toLocaleDateString('en-IN');
            const classNum = itemCount + 1;
            const finalTitle = ${playlistTitle} - Class  - ;
            console.log([YouTube] Generated Video Title: );

            // 4. Upload Video
            const fileSize = fs.statSync(videoPath).size;
            console.log("[YouTube] Uploading video file...");
            
            const res = await youtube.videos.insert({
                part: 'id,snippet,status',
                notifySubscribers: false,
                requestBody: {
                    snippet: { title: finalTitle, description: 'Automated Teams Recording' },
                    status: { privacyStatus: 'unlisted' }
                },
                media: { body: fs.createReadStream(videoPath) }
            }, {
                onUploadProgress: evt => {
                    const pct = Math.round((evt.bytesRead / fileSize) * 100);
                    if (onProgress) onProgress(pct);
                }
            });

            const videoId = res.data.id;
            const youtubeUrl = https://youtu.be/;
            console.log([YouTube] Upload complete! Video URL: );
            finalUrl = youtubeUrl;

            // 5. Add to Playlist
            if (playlistId) {
                console.log([YouTube] Adding video to playlist ...);
                await youtube.playlistItems.insert({
                    part: 'snippet',
                    requestBody: {
                        snippet: {
                            playlistId: playlistId,
                            resourceId: { kind: 'youtube#video', videoId: videoId }
                        }
                    }
                });
                console.log('[YouTube] Video added to playlist successfully!');
            }

            // Upload successful, break out of loop!
            return finalUrl;

        } catch (e) {
            console.error([YouTube] Error with :, e.message);
            lastError = e;
            // If it's a quota error (403), loop continues to try the next account
            if (e.message.toLowerCase().includes('quota') || e.code === 403) {
                console.log([YouTube] Quota exceeded on , switching to next account...);
                continue;
            }
            // If it's a different error (e.g. file missing), we shouldn't necessarily keep trying?
            // Actually, for maximum resilience, let's keep trying other accounts unless it's a completely fatal local error.
            continue;
        }
    }

    // If loop finishes without returning, all accounts failed
    throw new Error(All YouTube accounts failed. Last error: );
}

module.exports = { uploadToYouTube };'''

    text = text[:start_idx] + new_func
    
    with open('bot/youtube.js', 'w', encoding='utf-8') as f:
        f.write(text)
