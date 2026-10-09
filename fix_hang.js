const fs = require('fs');

function fixStopRecorder(file) {
    let code = fs.readFileSync(file, 'utf8');
    const regex = /async function stopRecorder\(proc\) \{[\s\S]*?\}\);[\s]*\}/;
    const replacement = `async function stopRecorder(proc) {
  return new Promise((resolve) => {
    if (!proc) return resolve();
    let resolved = false;
    const finish = () => { if (!resolved) { resolved = true; resolve(); } };
    proc.on('close', finish);
    proc.on('exit', finish);
    try { proc.kill('SIGINT'); } catch(e){}
    setTimeout(() => {
      try { process.kill(proc.pid, 'SIGKILL'); } catch(e){}
      finish();
    }, 5000);
  });
}`;
    code = code.replace(regex, replacement);
    
    // Also timeout browser.close()
    const browserRegex = /if \(browser\) await browser\.close\(\)\.catch\(\(\) => \{\}\);/;
    const browserRepl = `if (browser) {
      const bTimeout = setTimeout(() => { try { browser.process().kill('SIGKILL'); } catch(e){} }, 8000);
      await browser.close().catch(()=>{});
      clearTimeout(bTimeout);
    }`;
    code = code.replace(browserRegex, browserRepl);
    
    fs.writeFileSync(file, code);
}

fixStopRecorder('bot/live-recorder.js');
fixStopRecorder('bot/recorder.js');
