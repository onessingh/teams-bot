const { google } = require('googleapis');
const fs = require('fs');

async function uploadToYouTube(videoPath, subject, onProgress) {
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
        console.log(`[YouTube] Trying upload using ${cred.name}...`);
        
        try {
            const oauth2Client = new google.auth.OAuth2(cred.id, cred.sec);
            oauth2Client.setCredentials({ refresh_token: cred.token });
            const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
            
            let playlistId = null;
            let itemCount = 0;
            const playlistTitle = subject ? subject.trim() : 'Teams Classes';

            console.log(`[YouTube] Looking for playlist: ${playlistTitle} on ${cred.name}`);
            
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
            
            if (!playlistId) {
                console.log(`[YouTube] Playlist not found. Creating new playlist: ${playlistTitle}`);
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

            const dateStr = new Date().toLocaleDateString('en-IN');
            const classNum = itemCount + 1;
            const finalTitle = `${playlistTitle} - Class ${classNum} - ${dateStr}`;
            console.log(`[YouTube] Generated Video Title: ${finalTitle}`);

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
            const youtubeUrl = `https://youtu.be/${videoId}`;
            console.log(`[YouTube] Upload complete! Video URL: ${youtubeUrl}`);
            finalUrl = youtubeUrl;

            if (playlistId) {
                console.log(`[YouTube] Adding video to playlist ${playlistTitle}...`);
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

            return finalUrl;

        } catch (e) {
            console.error(`[YouTube] Error with ${cred.name}:`, e.message);
            lastError = e;
            if (e.message.toLowerCase().includes('quota') || e.code === 403) {
                console.log(`[YouTube] Quota exceeded on ${cred.name}, switching to next account...`);
                continue;
            }
            continue;
        }
    }

    throw new Error(`All YouTube accounts failed. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

module.exports = { uploadToYouTube };
