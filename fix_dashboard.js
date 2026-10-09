const fs = require('fs');
let code = fs.readFileSync('dashboard/app.js', 'utf8');

const regex = /let statusColor = "bg-gray-100 text-gray-600";[\s\S]*?if \(item\.status === 'FAILED' \|\| item\.status === 'TEAMS_LOGIN_REQUIRED'\) statusColor = "bg-red-100 text-red-700";/;

const replacement = `let statusColor = "bg-gray-100 text-gray-600";
          let friendlyStatus = statusText.replace(/_/g, ' ');
          if (item.status === 'WAITING') statusColor = "bg-yellow-100 text-yellow-700";
          if (item.status === 'STARTING_BROWSER' || item.status === 'OPENING_RECORDING') statusColor = "bg-purple-100 text-purple-700";
          if (item.status === 'WAITING_FOR_SCHEDULED_TIME') { statusColor = "bg-blue-100 text-blue-700 animate-pulse"; friendlyStatus = "JOINED EARLY - WAITING"; }
          if (item.status === 'WAITING_IN_LOBBY') { statusColor = "bg-orange-100 text-orange-700 animate-pulse"; friendlyStatus = "WAITING IN LOBBY"; }
          if (item.status === 'ADMITTED_PREPARING_UI') { statusColor = "bg-indigo-100 text-indigo-700"; friendlyStatus = "ADMITTED - PREPARING UI"; }
          if (item.status === 'RECORDING') statusColor = "bg-red-100 text-red-700 animate-pulse";
          if (item.status === 'UPLOADING') { statusColor = "bg-pink-100 text-pink-700 animate-pulse"; friendlyStatus = "UPLOADING TO YOUTUBE " + (item.upload_progress || 0) + "%"; }
          if (item.status === 'COMPLETED') statusColor = "bg-green-100 text-green-700";
          if (item.status === 'FAILED' || item.status === 'TEAMS_LOGIN_REQUIRED') statusColor = "bg-red-100 text-red-700";
          statusText = friendlyStatus;`;

code = code.replace(regex, replacement);
fs.writeFileSync('dashboard/app.js', code);
