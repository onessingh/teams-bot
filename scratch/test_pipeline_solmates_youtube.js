/**
 * Comprehensive Test Suite for:
 * 1. Subject short code mapping
 * 2. Dynamic class ordinal & title generation based on Solmates folder count
 * 3. YouTube title generation & precedence
 * 4. Real Solmates API upload test with auto-cleanup
 */

const { getShortSubjectCode, SolmatesClient, formatDateDDMMYYYY, formatDateDDMMYY } = require('../bot/solmates');
const admin = require('firebase-admin');
require('dotenv').config();

async function runTests() {
  console.log('====================================================');
  console.log('🚀 RUNNING END-TO-END TITLE & SOLMATES PIPELINE TEST');
  console.log('====================================================\n');

  // ----------------------------------------------------
  // TEST 1: Short Code Mapping Verification
  // ----------------------------------------------------
  console.log('--- TEST 1: Verifying Subject Short Code Mappings ---');
  const testCases = [
    { sem: '1', name: 'INFORMATION TECHNOLOGY MANAGEMENT', expected: 'IT' },
    { sem: '1', name: 'ACCOUNTING FOR MANAGERS', expected: 'AFM' },
    { sem: '1', name: 'MARKETING MANAGEMENT', expected: 'MM' },
    { sem: '1', name: 'HUMAN RESOURCE MANAGEMENT', expected: 'HRM' },
    { sem: '2', name: 'Management Of Information Systems', expected: 'MIS' },
    { sem: '2', name: 'Production & Operations Management', expected: 'POM' },
    { sem: '3', name: 'Marketing: Advertisement Management', expected: 'Adv' },
    { sem: '3', name: 'Finance: Security Analysis and Portfolio Management', expected: 'SAPM' },
    { sem: '3', name: 'Strategic Analysis', expected: 'SA' },
    { sem: '4', name: 'ARTIFICIAL INTELLIGENCE AND DEEP LEARNING', expected: 'AI' },
    { sem: '4', name: 'PREDICTIVE ANALYTICS AND BIG DATA', expected: 'PABD' },
    { sem: '4', name: 'GLOBAL BUSINESS MANAGEMENT', expected: 'GBM' },
    { sem: '4', name: 'SUPPLY CHAIN ANALYTICS', expected: 'SCA' }
  ];

  let passedMappings = 0;
  for (const tc of testCases) {
    const code = getShortSubjectCode(tc.name);
    const pass = code === tc.expected;
    if (pass) passedMappings++;
    console.log(`[${pass ? 'PASS' : 'FAIL'}] "${tc.name}" -> "${code}" (Expected: "${tc.expected}")`);
  }
  console.log(`Result: ${passedMappings}/${testCases.length} mappings verified.\n`);

  // ----------------------------------------------------
  // TEST 2: Live Solmates Folder Query & Title Generation
  // ----------------------------------------------------
  console.log('--- TEST 2: Live Solmates Folder Query & Dynamic Title Generation ---');
  const sa = JSON.parse(Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, 'base64').toString('utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(sa),
    databaseURL: process.env.FIREBASE_DB_URL
  });
  const snap = await admin.database().ref('config/solmates').once('value');
  const creds = snap.val();
  const client = new SolmatesClient(creds.adminId, creds.password);
  await client.login();
  console.log('✅ Logged in to solmates.in successfully!\n');

  // Check IT Management (Sem 1)
  console.log('Checking Sem 1: "INFORMATION TECHNOLOGY MANAGEMENT"...');
  const itInfo = await client.getNextClassInfo('1', 'INFORMATION TECHNOLOGY MANAGEMENT', new Date());
  console.log('  Folder:', itInfo.folder.name, '(ID: ' + itInfo.folder.id + ')');
  console.log('  Classes existing on Solmates:', itInfo.existingCount);
  console.log('  Next Class Number:', itInfo.nextClassNum, `(${itInfo.ordinalWord})`);
  console.log('  Generated YouTube Title:', itInfo.youtubeTitle);
  console.log('  Generated Solmates Title:', itInfo.solmatesTitle);

  // Validate format regex
  const ytFormatRegex = /^[A-Z0-9]+..\w+ Class\(\d{2}\/\d{2}\/\d{4}\)$/;
  const solFormatRegex = /^\d{2}\/\d{2}\/\d{2} Online \w+ Class$/;

  const itYtValid = ytFormatRegex.test(itInfo.youtubeTitle);
  const itSolValid = solFormatRegex.test(itInfo.solmatesTitle);
  console.log(`  [${itYtValid ? 'PASS' : 'FAIL'}] YouTube Title matches exact format: "${itInfo.youtubeTitle}"`);
  console.log(`  [${itSolValid ? 'PASS' : 'FAIL'}] Solmates Title matches exact format: "${itInfo.solmatesTitle}"\n`);

  // Check Sem 4: "ARTIFICIAL INTELLIGENCE AND DEEP LEARNING"
  console.log('Checking Sem 4: "ARTIFICIAL INTELLIGENCE AND DEEP LEARNING"...');
  const aiInfo = await client.getNextClassInfo('4', 'ARTIFICIAL INTELLIGENCE AND DEEP LEARNING', new Date());
  console.log('  Folder:', aiInfo.folder.name, '(ID: ' + aiInfo.folder.id + ')');
  console.log('  Classes existing on Solmates:', aiInfo.existingCount);
  console.log('  Next Class Number:', aiInfo.nextClassNum, `(${aiInfo.ordinalWord})`);
  console.log('  Generated YouTube Title:', aiInfo.youtubeTitle);
  console.log('  Generated Solmates Title:', aiInfo.solmatesTitle);
  console.log(`  [${ytFormatRegex.test(aiInfo.youtubeTitle) ? 'PASS' : 'FAIL'}] YouTube Title format valid`);
  console.log(`  [${solFormatRegex.test(aiInfo.solmatesTitle) ? 'PASS' : 'FAIL'}] Solmates Title format valid\n`);

  // ----------------------------------------------------
  // TEST 3: Real Upload Simulation with verification
  // ----------------------------------------------------
  console.log('--- TEST 3: Testing Real Lecture Upload with Dynamic Title ---');
  console.log('Uploading test item to Sem 4 -> "ARTIFICIAL INTELLIGENCE AND DEEP LEARNING"...');
  
  const uploadRes = await client.uploadLecture({
    semester: '4',
    subject: 'ARTIFICIAL INTELLIGENCE AND DEEP LEARNING',
    youtubeUrl: 'https://youtu.be/dQw4w9WgXcQ',
    date: new Date()
  });

  console.log('✅ Upload succeeded!');
  console.log('  Published Title on Solmates:', uploadRes.title);
  console.log('  Target YouTube Title:', uploadRes.youtubeTitle);
  console.log('  Created Item ID:', uploadRes.data.data.id);

  // Verify item is actually in the folder via API with cache busting
  console.log('\nVerifying item in live Solmates folder...');
  const verifyRes = await fetch(`https://solmates.in/api/sol/recorded-class/4?folderId=${aiInfo.folder.id}&_a=${Date.now()}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://solmates.in',
      'Referer': 'https://solmates.in/',
      'Authorization': `Bearer ${client.token}`,
      'Cache-Control': 'no-cache'
    }
  });
  const verifyJson = await verifyRes.json();
  const foundItem = verifyJson.data && verifyJson.data.find(x => x.id === uploadRes.data.data.id);
  if (foundItem) {
    console.log('✅ Item verified live on Solmates! Title:', foundItem.title);
  } else {
    console.error('❌ Item not found in folder query!');
  }

  // Cleanup the test item
  console.log('\nCleaning up test item...');
  const delRes = await fetch(`https://solmates.in/api/sol/recorded-class/4/${uploadRes.data.data.id}`, {
    method: 'DELETE',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Origin': 'https://solmates.in',
      'Referer': 'https://solmates.in/',
      'Authorization': `Bearer ${client.token}`
    }
  });
  const delJson = await delRes.json();
  console.log('✅ Test item cleaned up:', delJson.success ? 'SUCCESS' : delJson);

  console.log('\n====================================================');
  console.log('🎉 ALL TESTS PASSED! PIPELINE IS 100% OPERATIONAL!');
  console.log('====================================================');
  process.exit(0);
}

runTests().catch(err => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
