const fs = require('fs');
const lines = fs.readFileSync('bot/index.js', 'utf8').split('\n');

// Lines 117-149 (0-indexed: 116-148) are the broken try block without upload.
// We need to replace lines 116-148 (after the intro/outro try-catch which ends at 134/135) with proper upload + isPartial logic.
// The issue is that:
//   - Line 116 (0-indexed): a new `try {` block starts (for intro concat)
//   - The upload code is MISSING after line 136 (intro try-catch ends)
//   - Instead, partial queue code is there with undefined variables

// Let's replace lines 137-149 (0-indexed) with proper upload then isPartial check
const fixedLines = [
    '    // Upload to YouTube',
    "    await ref.update({ status: 'UPLOADING', updatedAt: Date.now() });",
    '    const ytResult = await uploadToYouTube(result.outputPath, {',
    "      title: item.title || 'Class Recording',",
    "      description: 'Automatically recorded class.',",
    '    });',
    '',
    '    await ref.update({',
    "      status: 'DONE',",
    '      youtube_url: ytResult?.url || null,',
    '      updatedAt: Date.now()',
    '    });',
    '    console.log(`\u2705 Done: ${item.title}`);',
    '',
    '    // If recording was cut short (max duration), queue next part',
    '    if (result.isPartial) {',
    '      const nextPartNum = (item.part || 1) + 1;',
    '      const newTitle = `${item.title || \'Class\'} (Part ${nextPartNum})`;',
    '      const newResumeTime = (item.resumeTime || 0) + Math.floor(result.durationRecordedMs / 1000);',
    "      await db.ref('queue').push({",
    '        url: item.url,',
    '        title: newTitle,',
    "        status: 'WAITING',",
    '        addedAt: Date.now(),',
    '        maxMs: item.maxMs || MAX_MS,',
    '        resumeTime: newResumeTime,',
    '        part: nextPartNum',
    '      });',
    '      console.log(`\uD83D\uDCDD Queued next part: ${newTitle} starting at ${newResumeTime}s`);',
    '    }',
];

// Replace lines 137-149 (0-indexed) -- these are the broken lines after intro try-catch
const newLines = [
    ...lines.slice(0, 137),
    ...fixedLines,
    ...lines.slice(150)
];

fs.writeFileSync('bot/index.js', newLines.join('\n'));
console.log('File rewritten. Total lines now:', newLines.length);
