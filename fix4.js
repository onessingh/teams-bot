const fs = require('fs');
let code = fs.readFileSync('bot/index.js', 'utf8');

const regex = /await ref\.update\(\{ status: 'RECORDING', updatedAt: Date\.now\(\) \}\);[\s\S]*?const newResumeTime = \(item\.resumeTime \|\| 0\) \+ Math\.floor\(result\.durationRecordedMs \/ 1000\);/;

const replacement = `await ref.update({ status: 'RECORDING', updatedAt: Date.now() });
    const result = await recordClass(item.url, outputPath, cookies, { 
      maxMs: item.maxMs || MAX_MS,
      resumeTime: item.resumeTime || 0,
      creds: creds,
      onAuthError: async (b64Image) => {
        await db.ref('state/mfa_screenshot').set(b64Image);
        await db.ref('state/login_status').set('WAITING_FOR_MFA');
      }
    });

    try {
      if (fs.existsSync('intro.mp4')) {
        console.log('[INFO] Normalizing intro.mp4 for concatenation...');
        const { execSync } = require('child_process');
        execSync('ffmpeg -y -i intro.mp4 -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2,fps=15" -c:v libx264 -preset ultrafast -crf 23 -pix_fmt yuv420p -c:a aac -b:a 128k -ar 44100 -ac 2 -movflags +faststart normalized_intro.mp4', {stdio: 'inherit'});
        
        if (fs.existsSync('normalized_intro.mp4') && fs.existsSync(result.outputPath)) {
          console.log('[INFO] Concatenating videos using extremely fast stream copy...');
          fs.writeFileSync('concat_list.txt', \`file 'normalized_intro.mp4'\\nfile '\${result.outputPath}'\\nfile 'normalized_intro.mp4'\\n\`);
          const finalPath = result.outputPath.replace('.mp4', '_final.mp4');
          execSync(\`ffmpeg -y -f concat -safe 0 -i concat_list.txt -c copy "\${finalPath}"\`, {stdio: 'inherit'});
          if (fs.existsSync(finalPath) && fs.statSync(finalPath).size > 1024) {
             fs.renameSync(finalPath, result.outputPath);
             console.log('[INFO] Successfully attached intro and outro to the class recording!');
          }
        }
      }
    } catch (err) {
      console.error('[ERROR] Failed to concatenate intro/outro:', err);
    }

    const newResumeTime = (item.resumeTime || 0) + Math.floor(result.durationRecordedMs / 1000);`;

code = code.replace(regex, replacement);
fs.writeFileSync('bot/index.js', code);
