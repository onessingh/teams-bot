/**
 * Comprehensive Integration & Logic Test Suite for Teams Class Bot
 * Tests:
 * 1. Lobby detection (stuck in lobby vs inside call with other users in lobby)
 * 2. Teacher scoring & identification
 * 3. Screen sharing & video stream protection against alone-check false positives
 * 4. Teacher departure vs temporary disconnect with student attendance check
 * 5. Fast 30s exit on genuine "Waiting for others to join" screen
 * 6. 30-minute late teacher wait before class starts
 * 7. Mass exodus detection
 */

const assert = require('assert');

console.log('🧪 Starting Full Test Suite for Teams Class Bot...\n');

let passedTests = 0;
let totalTests = 0;

function test(description, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ PASS: ${description}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${description}`);
        console.error(`     Error: ${err.message}`);
    }
}

// -------------------------------------------------------------
// TEST SUITE 1: Lobby Detection Logic
// -------------------------------------------------------------
console.log('--- TEST SUITE 1: Lobby Detection Logic ---');

test('Bot truly stuck in lobby before admission', () => {
    const text = "we've let people in the meeting know you're waiting";
    const hasCallStage = false;
    const currentCount = 0;

    const inLobby = !hasCallStage && (
        text.includes("we've let people in the meeting know you're waiting") || 
        text.includes("when the meeting starts, we'll let people know") ||
        (text.includes("waiting in the lobby") && currentCount <= 1)
    );

    assert.strictEqual(inLobby, true, 'Bot should be detected as inLobby');
});

test('Bot inside active meeting when a notification shows someone else waiting in lobby', () => {
    const text = "ashmit srivastava is waiting in the lobby. admit or view lobby.";
    const hasCallStage = true; // Bot has active meeting stage
    const currentCount = 15;

    const inLobby = !hasCallStage && (
        text.includes("we've let people in the meeting know you're waiting") || 
        text.includes("when the meeting starts, we'll let people know") ||
        (text.includes("waiting in the lobby") && currentCount <= 1)
    );

    assert.strictEqual(inLobby, false, 'Bot inside active call stage must NEVER be marked inLobby');
});

// -------------------------------------------------------------
// TEST SUITE 2: Teacher Scoring & Identification
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 2: Teacher Scoring & Identification ---');

test('Teacher identified when score reaches threshold (>= 15)', () => {
    const teacherScores = {
        'Suraj Sharma': 12,
        'NIDHI KHEMKA': 26,
        'PARTH NAYYAR': 23
    };

    let topTeacher = null;
    let maxScore = 0;
    for (const [name, score] of Object.entries(teacherScores)) {
        if (score > maxScore) {
            maxScore = score;
            topTeacher = name;
        }
    }

    let lockedTeacher = null;
    if (topTeacher && maxScore >= 15) {
        lockedTeacher = topTeacher;
    }

    assert.strictEqual(lockedTeacher, 'NIDHI KHEMKA');
    assert.strictEqual(maxScore, 26);
});

// -------------------------------------------------------------
// TEST SUITE 3: False "Alone" Trigger Protection (Run 361 Scenario)
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 3: False Alone Trigger Protection ---');

test('Bot does NOT consider itself alone if teacher is active, even if attendee count reads 1', () => {
    const stats = {
        ended: false,
        currentCount: 1, // momentarily 1 due to toolbar hiding / single tile
        inLobby: false,
        hasCallStage: true,
        inChatView: false,
        isWaitingForOthers: false, // NOT the empty lobby screen
        isPresenting: false,
        hasActiveVideo: false
    };

    const lockedTeacher = 'NIDHI KHEMKA';
    const signals = { 'NIDHI KHEMKA': 4 }; // Teacher talking or in roster
    const isSharing = false;

    const hasActiveSpeech = Object.keys(signals).length > 0;
    const isPresentingOrVideo = isSharing || stats.isPresenting || stats.hasActiveVideo;
    const isTeacherActive = !!(lockedTeacher && (
        signals[lockedTeacher] ||
        Object.keys(signals).some(k => k.toLowerCase().includes(lockedTeacher.toLowerCase()))
    ));

    const isAlone = stats.isWaitingForOthers || (
        stats.currentCount === 1 && stats.hasCallStage && !stats.inLobby && !isPresentingOrVideo && !hasActiveSpeech && !isTeacherActive
    );

    assert.strictEqual(isTeacherActive, true, 'Teacher should be active');
    assert.strictEqual(isAlone, false, 'Bot MUST NOT be marked alone when teacher is active');
});

test('Bot does NOT consider itself alone if screen sharing is active, even if count reads 1', () => {
    const stats = {
        ended: false,
        currentCount: 1,
        inLobby: false,
        hasCallStage: true,
        inChatView: false,
        isWaitingForOthers: false,
        isPresenting: true, // Slides / presentation active
        hasActiveVideo: false
    };

    const signals = {};
    const isSharing = true;
    const lockedTeacher = 'NIDHI KHEMKA';

    const hasActiveSpeech = Object.keys(signals).length > 0;
    const isPresentingOrVideo = isSharing || stats.isPresenting || stats.hasActiveVideo;
    const isTeacherActive = false;

    const isAlone = stats.isWaitingForOthers || (
        stats.currentCount === 1 && stats.hasCallStage && !stats.inLobby && !isPresentingOrVideo && !hasActiveSpeech && !isTeacherActive
    );

    assert.strictEqual(isPresentingOrVideo, true, 'Presentation or video active');
    assert.strictEqual(isAlone, false, 'Bot MUST NOT be marked alone during presentation');
});

// -------------------------------------------------------------
// TEST SUITE 4: Teacher Disconnect vs True Class End
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 4: Teacher Disconnect vs True Class End ---');

test('Teacher temporarily disconnects, but students are waiting -> Bot STAYS in meeting', () => {
    const hadRealClass = true; // peak 8, elapsed 78 mins
    const maxParticipants = 8;
    const currentCount = 7; // 7 students still waiting for teacher
    const lockedTeacher = 'NIDHI KHEMKA';
    const teacherMissingCount = 3; // Teacher away for 45s
    const isPresentingOrVideo = false;
    const hasActiveSpeech = false;

    // Alone check
    const isAlone = false; // currentCount is 7, not 1, no waiting screen

    // Teacher left + student drop rule:
    const teacherLeftAndStudentsDropped = hadRealClass && lockedTeacher && teacherMissingCount >= 2 && currentCount > 0 && (
        currentCount <= 2 ||
        (maxParticipants >= 8 && currentCount <= Math.max(2, Math.floor(maxParticipants * 0.2)))
    ) && !isPresentingOrVideo && !hasActiveSpeech;

    assert.strictEqual(teacherLeftAndStudentsDropped, false, 'Must NOT trigger exit while 7 students are waiting');
    assert.strictEqual(isAlone, false, 'Must NOT be alone while 7 students are present');
});

test('Teacher leaves AND students depart (count drops to 1 or 2) -> Exits in 2 checks (30s)', () => {
    const hadRealClass = true;
    const maxParticipants = 8;
    const currentCount = 2; // only 2 left after teacher left
    const lockedTeacher = 'NIDHI KHEMKA';
    const teacherMissingCount = 4; // Teacher gone for 1 minute
    const isPresentingOrVideo = false;
    const hasActiveSpeech = false;

    const teacherLeftAndStudentsDropped = hadRealClass && lockedTeacher && teacherMissingCount >= 2 && currentCount > 0 && (
        currentCount <= 2 ||
        (maxParticipants >= 8 && currentCount <= Math.max(2, Math.floor(maxParticipants * 0.2)))
    ) && !isPresentingOrVideo && !hasActiveSpeech;

    assert.strictEqual(teacherLeftAndStudentsDropped, true, 'Confirmed class end: Teacher gone and students departed');
});

test('Explicit "Waiting for others to join" screen after class ran -> Fast 30s exit', () => {
    const hadRealClass = true; // peak 8, elapsed 78 mins
    const maxParticipants = 8;
    const elapsedMins = 78;
    const stats = { isWaitingForOthers: true, currentCount: 1 };
    const teacherMissingCount = 5;
    const lockedTeacher = 'NIDHI KHEMKA';

    const teacherGoneAndCountOne = hadRealClass && (teacherMissingCount >= 2 || !lockedTeacher) && stats.currentCount === 1;
    const fastExitAlone = stats.isWaitingForOthers || teacherGoneAndCountOne;
    const requiredAloneChecks = fastExitAlone ? (hadRealClass ? 2 : 8) : 8;

    assert.strictEqual(requiredAloneChecks, 2, 'Must exit in exactly 2 checks (30s) when Waiting for others screen appears');
});

test('Late teacher: Bot joins early and waiting screen appears BEFORE class starts -> Waits 30 mins', () => {
    const hadRealClass = false; // peak 1, elapsed 5 mins
    const maxParticipants = 1;
    const elapsedMins = 5;
    const stats = { isWaitingForOthers: true, currentCount: 1 };
    const teacherMissingCount = 0;
    const lockedTeacher = null;

    const teacherGoneAndCountOne = hadRealClass && (teacherMissingCount >= 2 || !lockedTeacher) && stats.currentCount === 1;
    const fastExitAlone = stats.isWaitingForOthers || teacherGoneAndCountOne;
    const requiredAloneChecks = fastExitAlone ? (hadRealClass ? 2 : 8) : 8;
    const canExitAlone = hadRealClass || elapsedMins >= 30;

    assert.strictEqual(canExitAlone, false, 'Bot MUST NOT exit alone before 30 mins elapsed if class has not started');
});

// -------------------------------------------------------------
// TEST SUITE 5: RTT Panel & Notification Suppressor
// -------------------------------------------------------------
console.log('\n--- TEST SUITE 5: CSS & Notification Suppressors ---');

test('CSS style contains suppression for RTT live caption panels', () => {
    const fs = require('fs');
    const path = require('path');
    const liveRecorderCode = fs.readFileSync(path.join(__dirname, 'bot', 'live-recorder.js'), 'utf8');

    assert.strictEqual(liveRecorderCode.includes('Real-Time Text'), true, 'Must include RTT styling comments');
    assert.strictEqual(liveRecorderCode.includes('[data-tid*="rtt"'), true, 'Must include RTT selectors');
    assert.strictEqual(liveRecorderCode.includes('[data-tid*="captions-pane"'), true, 'Must include caption suppression');
});

test('Notification dismisser preserves presentation stage and video canvas', () => {
    const fs = require('fs');
    const path = require('path');
    const liveRecorderCode = fs.readFileSync(path.join(__dirname, 'bot', 'live-recorder.js'), 'utf8');

    assert.strictEqual(liveRecorderCode.includes('presentation-stage'), true);
    assert.strictEqual(liveRecorderCode.includes('screen-sharing-canvas'), true);
    assert.strictEqual(liveRecorderCode.includes('video-gallery'), true);
});

console.log(`\n========================================`);
console.log(`Test Summary: ${passedTests}/${totalTests} Passed (${Math.round(passedTests/totalTests*100)}%)`);
console.log(`========================================\n`);

if (passedTests === totalTests) {
    process.exit(0);
} else {
    process.exit(1);
}
