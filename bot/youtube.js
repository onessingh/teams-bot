const { google } = require('googleapis');
const fs = require('fs');

async function uploadToYouTube(videoPath, subject, onProgress) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    
    let playlistId = null;
    let itemCount = 0;
    const playlistTitle = subject ? subject.trim() : 'Teams Classes';

    console.log(`[YouTube] Looking for playlist: ${playlistTitle}`);
    
    // 1. Search for existing playlist
    try {
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
            console.log(`[YouTube] Playlist not found. Creating new playlist: ${playlistTitle}`);
            const createRes = await youtube.playlists.insert({
                part: 'snippet,status',
                requestBody: {
                    snippet: {
                        title: playlistTitle,
                        description: 'Automated Class Recordings'
                    },
                    status: { privacyStatus: 'unlisted' }
                }
            });
            playlistId = createRes.data.id;
            itemCount = 0;
        }
    } catch (e) {
        console.error('[YouTube] Playlist fetch/create error:', e.message);
    }

    // 3. Formulate Title (e.g. Physics - Class 4 - 24/05/2026)
    const dateStr = new Date().toLocaleDateString('en-IN');
    const classNum = itemCount + 1;
    const finalTitle = `${playlistTitle} - Class ${classNum} - ${dateStr}`;
    console.log(`[YouTube] Generated Video Title: ${finalTitle}`);

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
            const progress = (evt.bytesRead / fileSize) * 100;
            if (onProgress) onProgress(Math.round(progress));
        }
    });
    
    const videoId = res.data.id;
    console.log(`[YouTube] Video uploaded successfully: https://youtu.be/${videoId}`);

    // 5. Add to Playlist
    if (playlistId) {
        try {
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
        } catch (e) {
            console.error('[YouTube] Failed to add video to playlist:', e.message);
        }
    }

    return `https://youtu.be/${videoId}`;
}

module.exports = { uploadToYouTube };
