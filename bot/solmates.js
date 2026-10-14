/**
 * solmates.js
 * Automated integration with solmates.in for auto-publishing YouTube lectures
 * to the correct Semester, Specialisation, and Subject folder.
 */

const https = require('https');

const API_BASE = 'https://solmates.in/api';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const ORDINAL_WORDS = [
  'Zero', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 
  'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth',
  'Sixteenth', 'Seventeenth', 'Eighteenth', 'Nineteenth', 'Twentieth'
];

function getOrdinalWord(n) {
  return ORDINAL_WORDS[n] || `${n}th`;
}

function formatDateDDMMYY(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

function formatDateYYYYMMDD(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

function normalize(str) {
  return (str || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

function apiRequest(path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(API_BASE + path);
    const headers = {
      'User-Agent': BROWSER_UA,
      'Origin': 'https://solmates.in',
      'Referer': 'https://solmates.in/'
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (method.toUpperCase() === 'GET') {
      url.searchParams.set('_a', Date.now().toString());
      headers['Cache-Control'] = 'no-cache';
    }
    let payload = null;
    if (body) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(url, { method, headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(data);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

class SolmatesClient {
  constructor(adminId, password) {
    this.adminId = adminId;
    this.password = password;
    this.token = null;
  }

  async login() {
    if (!this.adminId || !this.password) {
      throw new Error('Solmates Admin ID or Password not configured.');
    }
    const res = await apiRequest('/auth/login', 'POST', {
      adminId: this.adminId,
      password: this.password
    });
    if (!res || !res.success || !res.token) {
      throw new Error(`Solmates login failed: ${res ? res.error || JSON.stringify(res) : 'No response'}`);
    }
    this.token = res.token;
    return this.token;
  }

  /**
   * Resolve target Subject folderId on solmates.in
   * Handles:
   * - Semester 1 & 2: direct subject folders (ignores "Recorded 2025 Batch")
   * - Semester 3 & 4: specialisation folders (Core, Finance, Marketing, HR) -> subject folder
   */
  async resolveSubjectFolder(semester, subjectName) {
    const sem = String(semester);
    const res = await apiRequest(`/sol/folders/recorded-class/${sem}`);
    if (!res || !res.data) {
      throw new Error(`Failed to fetch folders for Semester ${sem}`);
    }

    // Filter out historical archive folders like "Recorded 2025 Batch"
    const activeFolders = res.data.filter(f => !/recorded\s*\d{4}/i.test(f.name));

    // For Semester 1 & 2: Direct match with active folders
    if (sem === '1' || sem === '2') {
      const normTarget = normalize(subjectName);
      const match = activeFolders.find(f => {
        const nf = normalize(f.name);
        return nf === normTarget || nf.includes(normTarget) || normTarget.includes(nf);
      });
      if (match) return match;
      throw new Error(`Subject folder "${subjectName}" not found in Semester ${sem}`);
    }

    // For Semester 3 & 4: Folder hierarchy (Specialisation -> Subject)
    // E.g. subjectName might be "Finance: Security Analysis and Portfolio Management"
    // or "Security Analysis and Portfolio Management"
    let specPart = '';
    let subjPart = subjectName;
    if (subjectName.includes(':')) {
      const parts = subjectName.split(':');
      specPart = parts[0].trim();
      subjPart = parts.slice(1).join(':').trim();
    }

    const normSubj = normalize(subjPart);

    // 1. Direct match on root folders (e.g. "ADDITIONAL COURSES" or direct subject)
    const directMatch = activeFolders.find(f => {
      const nf = normalize(f.name);
      return nf === normSubj || nf.includes(normSubj) || normSubj.includes(nf);
    });
    if (directMatch) {
      const subRes = await apiRequest(`/sol/folders/recorded-class/${sem}?parentId=${directMatch.id}`);
      if (!subRes || !subRes.data || subRes.data.length === 0) {
        // Direct folder has no subfolders, items are placed directly here!
        return directMatch;
      }
    }

    // 2. Look inside each specialisation group
    for (const group of activeFolders) {
      // If user specified spec (e.g. "Finance" or "Core"), check if group matches
      if (specPart) {
        const normGroup = normalize(group.name);
        const normSpec = normalize(specPart);
        if (!normGroup.includes(normSpec) && !normSpec.includes(normGroup)) {
          continue; // Skip groups that don't match specified specialization
        }
      }

      // Fetch subfolders inside this group
      const subRes = await apiRequest(`/sol/folders/recorded-class/${sem}?parentId=${group.id}`);
      if (subRes && subRes.data) {
        const match = subRes.data.find(f => {
          const nf = normalize(f.name);
          return nf === normSubj || nf.includes(normSubj) || normSubj.includes(nf);
        });
        if (match) {
          return match;
        }
      }
    }

    // Fallback: search all subfolders across all groups if spec wasn't specified
    if (!specPart) {
      for (const group of activeFolders) {
        const subRes = await apiRequest(`/sol/folders/recorded-class/${sem}?parentId=${group.id}`);
        if (subRes && subRes.data) {
          const match = subRes.data.find(f => {
            const nf = normalize(f.name);
            return nf === normSubj || nf.includes(normSubj) || normSubj.includes(nf);
          });
          if (match) return match;
        }
      }
    }

    throw new Error(`Subject folder "${subjectName}" not found in Semester ${sem} groups.`);
  }

  /**
   * Upload video to solmates.in
   */
  async uploadLecture({ semester, subject, youtubeUrl, date = new Date() }) {
    if (!this.token) {
      await this.login();
    }

    const folder = await this.resolveSubjectFolder(semester, subject);
    console.log(`[Solmates] Found folder: "${folder.name}" (ID: ${folder.id}) for ${subject}`);

    // Fetch existing classes in this folder to calculate next class number
    const itemsRes = await apiRequest(`/sol/recorded-class/${semester}?folderId=${folder.id}`);
    const existingCount = (itemsRes && itemsRes.data) ? itemsRes.data.length : 0;
    const nextClassNum = existingCount + 1;
    const ordinalWord = getOrdinalWord(nextClassNum);
    
    const dateFormatted = formatDateDDMMYY(date);
    const title = `${dateFormatted} Online ${ordinalWord} Class`;
    const ymd = formatDateYYYYMMDD(date);

    console.log(`[Solmates] Creating new item: "${title}" in "${folder.name}" with URL: ${youtubeUrl}`);

    const res = await apiRequest(`/sol/recorded-class/${semester}`, 'POST', {
      folderId: folder.id,
      title: title,
      link: youtubeUrl,
      date: ymd,
      semester: String(semester)
    }, this.token);

    if (res && (res.success || res._id || res.id)) {
      console.log(`✅ [Solmates] Successfully published to solmates.in: "${title}"`);
      return { success: true, title, folderName: folder.name, data: res };
    } else {
      throw new Error(`[Solmates] Failed to add item: ${JSON.stringify(res)}`);
    }
  }
}

module.exports = {
  SolmatesClient,
  formatDateDDMMYY,
  getOrdinalWord
};
