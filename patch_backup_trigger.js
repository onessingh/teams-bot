const fs = require('fs');
let appJs = fs.readFileSync('dashboard/app.js', 'utf8');

const backupTrigger = `
  populateSubjects('vod-semester', 'vod-subject');
  populateSubjects('live-semester', 'live-subject');
  
  // ==========================================
  // FRONTEND BACKUP SCHEDULER
  // ==========================================
  setInterval(async () => {
      if (!window.liveQueueItemsData) return;
      const now = Date.now();
      const token = localStorage.getItem('teams_gh_pat');
      if (!token) return; // If no token in browser, we can't do the backup trigger.

      for (const item of window.liveQueueItemsData) {
          if (item.status === 'WAITING' && item.scheduledTime > 0) {
              // Same time window as backend: 20 mins before to 5 mins after
              if (now >= item.scheduledTime - (20 * 60 * 1000) && now <= item.scheduledTime + (5 * 60 * 1000)) {
                  
                  if (!window.autoTriggerFired) {
                      window.autoTriggerFired = true;
                      setTimeout(() => window.autoTriggerFired = false, 300000); // 5 min cooldown
                      
                      try {
                          console.log('[BackupTrigger] Firing GitHub Action for', item.title);
                          const response = await fetch('https://api.github.com/repos/onessingh/teams-bot/dispatches', {
                              method: 'POST',
                              headers: {
                                  'Accept': 'application/vnd.github.v3+json',
                                  'Authorization': 'token ' + token
                              },
                              body: JSON.stringify({ event_type: 'start-live-processing' })
                          });
                          
                          if (response.ok) {
                              console.log('[BackupTrigger] Successfully fired!');
                          } else if (response.status === 401) {
                              console.log('[BackupTrigger] Token expired or invalid.');
                              localStorage.removeItem('teams_gh_pat');
                              window.autoTriggerFired = false;
                          } else {
                              console.log('[BackupTrigger] Error', response.status);
                          }
                      } catch (e) {
                          console.log('[BackupTrigger] Failed', e);
                      }
                  }
              }
          }
      }
  }, 30000); // Check every 30 seconds
`;

appJs = appJs.replace(/populateSubjects\('live-semester', 'live-subject'\);/, backupTrigger);

fs.writeFileSync('dashboard/app.js', appJs, 'utf8');
console.log('Added frontend backup trigger');
