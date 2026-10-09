const fs = require('fs');
let code = fs.readFileSync('bot/live-index.js', 'utf8');

const regex = /try\s*\{\s*if\s*\(fs\.existsSync\('intro\.mp4'\)\)\s*\{[\s\S]*?\/\/\s*Continue uploading original video if concat fails\s*\}\s*\}/;

const goodBlock = `
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
`;

code = code.replace(regex, goodBlock);
fs.writeFileSync('bot/live-index.js', code);
