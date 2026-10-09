const fs = require('fs');
let code = fs.readFileSync('bot/index.js', 'utf8');

// Find the broken section and replace it completely
const brokenSection = `    const newResumeTime = (item.resumeTime || 0) + Math.floor(result.durationRecordedMs / 1000);\r\n      \r\n      await db.ref('queue').push({\r\n        url: item.url,\r\n        title: newTitle,\r\n        status: 'WAITING',\r\n        addedAt: Date.now(),\r\n        maxMs: item.maxMs || MAX_MS,\r\n        resumeTime: newResumeTime,\r\n        part: nextPartNum\r\n      });\r\n      console.log(\`?? Queued next part: \${newTitle} starting at \${newResumeTime}s\`);\r\n    }`;

const fixedSection = `    // Upload to YouTube
    await ref.update({ status: 'UPLOADING', updatedAt: Date.now() });
    const ytResult = await uploadToYouTube(result.outputPath, {
      title: item.title || 'Class Recording',
      description: 'Automatically recorded class.',
    });

    await ref.update({
      status: 'DONE',
      youtube_url: ytResult?.url || null,
      updatedAt: Date.now()
    });
    console.log(\`? Done: \${item.title}\`);

    // If recording was cut short (max duration), queue next part
    if (result.isPartial) {
      const nextPartNum = (item.part || 1) + 1;
      const newTitle = \`\${item.title || 'Class'} (Part \${nextPartNum})\`;
      const newResumeTime = (item.resumeTime || 0) + Math.floor(result.durationRecordedMs / 1000);
      await db.ref('queue').push({
        url: item.url,
        title: newTitle,
        status: 'WAITING',
        addedAt: Date.now(),
        maxMs: item.maxMs || MAX_MS,
        resumeTime: newResumeTime,
        part: nextPartNum
      });
      console.log(\`?? Queued next part: \${newTitle} starting at \${newResumeTime}s\`);
    }`;

if (code.includes(brokenSection)) {
  code = code.replace(brokenSection, fixedSection);
  console.log("Found and replaced via exact match");
} else {
  console.log("Exact match not found, using line-based approach");
}
fs.writeFileSync('bot/index.js', code);
