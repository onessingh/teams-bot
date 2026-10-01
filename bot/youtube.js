const { google } = require('googleapis');
const fs = require('fs');

async function uploadToYouTube(videoPath, title) {
    const oauth2Client = new google.auth.OAuth2(
        process.env.YOUTUBE_CLIENT_ID,
        process.env.YOUTUBE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.YOUTUBE_REFRESH_TOKEN });

    const youtube = google.youtube({ version: 'v3', auth: oauth2Client });
    const fileSize = fs.statSync(videoPath).size;

    console.log("Uploading to YouTube...");
    const res = await youtube.videos.insert({
        part: 'id,snippet,status',
        notifySubscribers: false,
        requestBody: {
            snippet: { title: title, description: 'Automated Teams Recording' },
            status: { privacyStatus: 'unlisted' }
        },
        media: { body: fs.createReadStream(videoPath) }
    }, {
        onUploadProgress: evt => {
            const progress = (evt.bytesRead / fileSize) * 100;
            console.log(`${Math.round(progress)}% uploaded...`);
        }
    });

    return `https://youtu.be/${res.data.id}`;
}

module.exports = { uploadToYouTube };
