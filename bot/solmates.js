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

function formatDateDDMMYYYY(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

function formatDateYYYYMMDD(d = new Date()) {
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${year}-${month}-${day}`;
}

const SUBJECT_SHORT_CODES = {
  // Semester 1
  'information technology management': 'IT',
  'accounting for managers': 'AFM',
  'marketing management': 'MM',
  'human resource management': 'HRM',
  'managerial economics': 'ME',
  'business communication': 'BC',
  'data analysis and decision tools': 'DADT',
  'organisational behaviour': 'OB',
  'organizational behaviour': 'OB',

  // Semester 2
  'management of information systems': 'MIS',
  'marketing research': 'MR',
  'production & operations management': 'POM',
  'production and operations management': 'POM',
  'management accounting': 'MA',
  'corporate finance': 'CF',
  'decision modeling & optimization': 'DMO',
  'economic environment of businesses': 'EEB',
  'organisation effectiveness & change': 'OEC',
  'organizational effectiveness & change': 'OEC',

  // Semester 3
  'strategic analysis': 'SA',
  'business ethics and sustainability': 'BES',
  'entrepreneurship, creativity and innovation': 'ECI',
  'entrepreneurship creativity and innovation': 'ECI',
  'security analysis and portfolio management': 'SAPM',
  'financial markets & institutions': 'FMI',
  'financial markets and institutions': 'FMI',
  'mergers and corporate restructuring': 'MCR',
  'international financial management': 'IFM',
  'financial derivatives': 'FD',
  'advertisement management': 'Adv',
  'advertising management': 'Adv',
  'consumer behaviour': 'CB',
  'consumer behavior': 'CB',
  'services marketing': 'SM',
  'digital marketing': 'DM',
  'brand management': 'BM',
  'human resource development': 'HRD',
  'human resource development : strategies and systems': 'HRD',
  'leadership , power and politics': 'LPP',
  'leadership power and politics': 'LPP',
  'performance management and training intervention': 'PMTI',
  'compensation and reward management': 'CRM',
  'cross cultural and global management': 'CCGM',

  // Semester 4
  'artificial intelligence and deep learning': 'AI',
  'predictive analytics and big data': 'PABD',
  'global business management': 'GBM',
  'legal environment of business': 'LEB',
  'strategic management': 'SM',
  'corporate tax': 'CT',
  'financial reporting': 'FR',
  'financial risk management': 'FRM',
  'fixed income securities': 'FIS',
  'merchant banking and financial services': 'MBFS',
  'quantitative analysis of financial decision': 'QAFD',
  'business marketing': 'BM',
  'competitive marketing': 'CM',
  'marketing analytics': 'MA',
  'rural marketing': 'RM',
  'sales force management': 'SFM',
  'hr metrics and analytics': 'HRMA',
  'counselling skills for managers': 'CSM',
  'management of industrial relations': 'MIR',
  'managing interpersonal and group process': 'MIGP',
  'negotiation and influence skills': 'NIS',
  'operation strategy': 'OS',
  'supply chain analytics': 'SCA',
  'supply chain management': 'SCM',
  'system optimisation and management science': 'SOMS',
  'system optimization and management science': 'SOMS',
  'technology innovation and new product management': 'TINPM',
  'international business strategy': 'IBS',
  'strategic capability building and innovation': 'SCBI',
  'strategic innovation in health care and education': 'SIHE',
  'strategic management in social enterprises': 'SMSE',
  'strategic management of startups': 'SMS'
};

function getShortSubjectCode(rawSubject) {
  if (!rawSubject) return 'Class';
  let clean = rawSubject;
  if (clean.includes(':')) {
    clean = clean.split(':').slice(1).join(':').trim();
  }
  clean = clean.replace(/\(Sem\s*\d+\)/gi, '').trim();

  const norm = clean.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  
  if (SUBJECT_SHORT_CODES[norm]) return SUBJECT_SHORT_CODES[norm];

  for (const [key, code] of Object.entries(SUBJECT_SHORT_CODES)) {
    if (norm.includes(key) || key.includes(norm)) {
      return code;
    }
  }

  const words = clean.split(/\s+/).filter(w => !/^(and|of|for|in|&|the)$/i.test(w));
  if (words.length > 0) {
    const initials = words.map(w => w[0].toUpperCase()).join('');
    if (initials.length >= 2 && initials.length <= 5) return initials;
  }
  return clean.slice(0, 10).trim();
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
   * Determine the next class number and title directly from Solmates.in folder!
   */
  async getNextClassInfo(semester, subject, date = new Date()) {
    const folder = await this.resolveSubjectFolder(semester, subject);

    // Fetch existing classes in this folder to calculate next class number
    const itemsRes = await apiRequest(`/sol/recorded-class/${semester}?folderId=${folder.id}`);
    const existingCount = (itemsRes && Array.isArray(itemsRes.data)) ? itemsRes.data.length : 0;
    const nextClassNum = existingCount + 1;
    const ordinalWord = getOrdinalWord(nextClassNum);

    const shortCode = getShortSubjectCode(subject);
    const dateFormattedYMD = formatDateYYYYMMDD(date);
    const dateFormattedDDMMYY = formatDateDDMMYY(date);
    const dateFormattedDDMMYYYY = formatDateDDMMYYYY(date);

    const youtubeTitle = `${shortCode}..${ordinalWord} Class(${dateFormattedDDMMYYYY})`;
    const solmatesTitle = `${dateFormattedDDMMYY} Online ${ordinalWord} Class`;

    return {
      folder,
      existingCount,
      nextClassNum,
      ordinalWord,
      shortCode,
      youtubeTitle,
      solmatesTitle,
      dateFormattedYMD
    };
  }

  /**
   * Upload video to solmates.in
   */
  async uploadLecture({ semester, subject, youtubeUrl, date = new Date(), customTitle = null }) {
    if (!this.token) {
      await this.login();
    }

    const info = await this.getNextClassInfo(semester, subject, date);
    const finalTitle = customTitle || info.solmatesTitle;

    console.log(`[Solmates] Folder: "${info.folder.name}" | Existing: ${info.existingCount} | Next: ${info.ordinalWord} Class`);
    console.log(`[Solmates] Titles -> YouTube: "${info.youtubeTitle}" | Solmates: "${finalTitle}"`);

    const res = await apiRequest(`/sol/recorded-class/${semester}`, 'POST', {
      folderId: info.folder.id,
      title: finalTitle,
      link: youtubeUrl,
      pdf: youtubeUrl,
      subject: finalTitle,
      date: info.dateFormattedYMD,
      semester: String(semester)
    }, this.token);

    if (res && (res.success || res._id || res.id)) {
      console.log(`✅ [Solmates] Successfully published to solmates.in: "${finalTitle}"`);
      return { 
        success: true, 
        title: finalTitle, 
        youtubeTitle: info.youtubeTitle, 
        folderName: info.folder.name, 
        classNum: info.nextClassNum,
        ordinalWord: info.ordinalWord,
        data: res 
      };
    } else {
      throw new Error(`[Solmates] Failed to add item: ${JSON.stringify(res)}`);
    }
  }
}

module.exports = {
  SolmatesClient,
  formatDateDDMMYY,
  formatDateDDMMYYYY,
  getOrdinalWord,
  getShortSubjectCode,
  SUBJECT_SHORT_CODES
};
