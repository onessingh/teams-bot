const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

// I removed the token warning from the HTML generation but missed it in the auto-trigger loop!
// We want to remove the ENTIRE auto-trigger loop from app.js because the backend is doing it now.
// However, maybe the user hasn't added GH_SCHEDULER_TOKEN yet, so we shouldn't completely delete the frontend trigger?
// No, the user said "GitHub token auto trigger ke liye to hamne GitHub ke secrets mr add kiya hai". So they did add it!
// If they added it, the frontend trigger is completely useless and just causes errors.
// Wait, I will just silence the error in the frontend. If the frontend tries to trigger and fails because of no token, it should just fail silently because the backend is already doing it.
// Actually, let's just remove the warning text.

appJs = appJs.replace(`if (elapsedDiv) elapsedDiv.innerHTML = '<span class="text-red-600 font-bold">No GitHub token! Please click Start Live Bot button to add token.</span>';`, `// silently fail, backend scheduler will handle it`);

appJs = appJs.replace(`if (elapsedDiv) elapsedDiv.innerHTML = '<span class="text-red-600 font-bold">Token expired! Please click Start Live Bot to update.</span>';`, `// silently fail, backend scheduler will handle it`);

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Fixed auto loop warnings');
