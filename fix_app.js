const fs = require('fs');
let js = fs.readFileSync('dashboard/app.js', 'utf8');

js = js.replace(/} else if \(state\.login_status === "WAITING_FOR_MFA"\) {[\s\S]*?} else if \(state\.login_status === "FAILED"\) {[\s\S]*?}/, 
} else if (state.login_status === "WAITING_FOR_MFA") {
        mfaStatusText.textContent = "Approve this request on your phone!";
        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";
    } else if (state.login_status === "FAILED") {
        mfaStatusText.textContent = "Login Failed. See screenshot below.";
        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";
    }
    
    if (state.mfa_screenshot && (state.login_status === "WAITING_FOR_MFA" || state.login_status === "FAILED")) {
        mfaScreenshot.src = state.mfa_screenshot;
        mfaScreenshot.classList.remove('hidden');
    });

fs.writeFileSync('dashboard/app.js', js);
