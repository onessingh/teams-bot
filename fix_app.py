import os

with open('dashboard/app.js', 'r', encoding='utf-8') as f:
    content = f.read()

import re
content = re.sub(
    r'\} else if \(state.login_status === "WAITING_FOR_MFA"\) \{.*?\} else if \(state.login_status === "FAILED"\) \{.*?\n\}\);',
    '} else if (state.login_status === "WAITING_FOR_MFA") {\n        mfaStatusText.textContent = "Approve this request on your phone!";\n        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";\n    } else if (state.login_status === "FAILED") {\n        mfaStatusText.textContent = "Login Failed. See screenshot below.";\n        mfaStatusText.className = "text-sm font-bold text-red-600 mb-3";\n    }\n    \n    if (state.mfa_screenshot && (state.login_status === "WAITING_FOR_MFA" || state.login_status === "FAILED")) {\n        mfaScreenshot.src = state.mfa_screenshot;\n        mfaScreenshot.classList.remove(\'hidden\');\n    }\n});',
    content,
    flags=re.DOTALL
)

with open('dashboard/app.js', 'w', encoding='utf-8') as f:
    f.write(content)
