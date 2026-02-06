// Answer locking functions
export function lockAnswers() {
    sessionStorage.setItem('answers_locked', 'true');
}

export function isLocked() {
    return sessionStorage.getItem('answers_locked') === 'true';
}

// Write functions with lock protection - DEPRECATED: Use centralized saveAnswer() instead
// Kept for backward compatibility only, but should not be used for new code
export function saveAnswerToStorage(testId, taskIndexOrKey, text) {
    console.warn('[answers] saveAnswerToStorage is deprecated. Use saveAnswer() with skill parameter.');
    if (isLocked()) return;
    // Attempt to infer skill from context
    const skill = sessionStorage.getItem('current_skill');
    if (skill) {
        saveAnswer({ skill, testId, type: 'gap', id: taskIndexOrKey, value: text });
    }
}

export function getAnswerFromStorage(testId, keySuffix) {
    console.warn('[answers] getAnswerFromStorage is deprecated. Use getAnswer() with skill parameter.');
    const skill = sessionStorage.getItem('current_skill');
    if (skill) {
        return getAnswer({ skill, testId, type: 'gap', id: keySuffix });
    }
    return '';
}

export function getMcqAnswerFromStorage(testId, blockId, questionId) {
    console.warn('[answers] getMcqAnswerFromStorage is deprecated. Use getAnswer() with skill parameter.');
    const skill = sessionStorage.getItem('current_skill') || 'listening';
    return getAnswer({ skill, testId, type: 'mcq', id: `${blockId}:${questionId}` });
}

export function setMcqAnswerToStorage(testId, blockId, questionId, value) {
    console.warn('[answers] setMcqAnswerToStorage is deprecated. Use saveAnswer() with skill parameter.');
    if (isLocked()) return;
    const skill = sessionStorage.getItem('current_skill') || 'listening';
    saveAnswer({ skill, testId, type: 'mcq', id: `${blockId}:${questionId}`, value });
}

export function getMatchingAnswerFromStorage(testId, blockId) {
    console.warn('[answers] getMatchingAnswerFromStorage is deprecated. Use getAnswer() with skill parameter.');
    const skill = sessionStorage.getItem('current_skill') || 'listening';
    return getAnswer({ skill, testId, type: 'matching', id: blockId });
}

export function setMatchingAnswerToStorage(testId, blockId, matches) {
    console.warn('[answers] setMatchingAnswerToStorage is deprecated. Use saveAnswer() with skill parameter.');
    if (isLocked()) return;
    const skill = sessionStorage.getItem('current_skill') || 'listening';
    saveAnswer({ skill, testId, type: 'matching', id: blockId, value: matches });
}

export function getTfngAnswerFromStorage(testId, blockId, questionId) {
    console.warn('[answers] getTfngAnswerFromStorage is deprecated. Use getAnswer() with skill parameter.');
    const skill = sessionStorage.getItem('current_skill') || 'reading';
    return getAnswer({ skill, testId, type: 'tfng', id: `${blockId}:${questionId}` });
}

export function setTfngAnswerToStorage(testId, blockId, questionId, value) {
    console.warn('[answers] setTfngAnswerToStorage is deprecated. Use saveAnswer() with skill parameter.');
    if (isLocked()) return;
    const skill = sessionStorage.getItem('current_skill') || 'reading';
    saveAnswer({ skill, testId, type: 'tfng', id: `${blockId}:${questionId}`, value });
}

function writeToStorages(key, value) {
    try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
    } catch (e) {
        console.warn('[answers] sessionStorage write failed:', e);
    }
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(key, value);
    } catch (e) {
        console.warn('[answers] localStorage write failed:', e);
    }
}

function readFromStorages(key) {
    try {
        if (typeof sessionStorage !== 'undefined') {
            const v = sessionStorage.getItem(key);
            if (v !== null && v !== undefined) return v;
        }
    } catch (e) {
        console.warn('[answers] sessionStorage read failed:', e);
    }
    try {
        if (typeof localStorage !== 'undefined') return localStorage.getItem(key);
    } catch (e) {
        console.warn('[answers] localStorage read failed:', e);
    }
    return null;
}
function sanitizeForId(value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
}

export function ensureAttemptId() {
    const existing = sessionStorage.getItem('test_attempt_id');
    if (existing) return existing;
    try {
        if (typeof localStorage !== 'undefined') {
            const cached = localStorage.getItem('test_attempt_id');
            if (cached) {
                sessionStorage.setItem('test_attempt_id', cached);
                return cached;
            }
        }
    } catch (e) {
        console.warn('[answers] localStorage attemptId read failed:', e);
    }
    const candidateId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
    const scheduleId = sessionStorage.getItem('candidate_schedule_id');
    const examId = sessionStorage.getItem('candidate_exam_id');
    if (!candidateId || !scheduleId || !examId) return null;
    const attemptId = `draft_${sanitizeForId(candidateId)}_${sanitizeForId(scheduleId)}_${sanitizeForId(examId)}`;
    sessionStorage.setItem('test_attempt_id', attemptId);
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('test_attempt_id', attemptId);
    } catch (e) {
        console.warn('[answers] localStorage attemptId write failed:', e);
    }
    return attemptId;
}

let __syncTimer = null;

async function syncProgress() {
    const attemptId = ensureAttemptId();
    if (!attemptId) return;
    try {
        const { upsertAttemptProgress } = await import('../../db/db.attempts.js');
        const candidateId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
        const scheduleId = sessionStorage.getItem('candidate_schedule_id');
        const examId = sessionStorage.getItem('candidate_exam_id');
        const candidateName = sessionStorage.getItem('candidate_full_name') || '';
        const testerId = sessionStorage.getItem('candidate_tester_id') || '';
        const skills = buildSkillsPayload({});
        await upsertAttemptProgress({
            attemptId,
            candidateId,
            scheduleId,
            examId,
            candidateName,
            testerId,
            skills,
            status: 'in_progress'
        });
    } catch (e) {
        console.warn('[answers] Progress sync failed:', e);
    }
}

function queueProgressSync() {
    if (__syncTimer) clearTimeout(__syncTimer);
    __syncTimer = setTimeout(() => {
        syncProgress();
        __syncTimer = null;
    }, 1200);
}

export function applySkillsPayloadToSession(skills) {
    if (!skills || typeof skills !== 'object') return;
    Object.entries(skills).forEach(([skill, payload]) => {
        const testId = payload?.testId;
        const answers = payload?.answers || {};
        if (!testId) return;

        const gap = answers.gap || {};
        Object.entries(gap).forEach(([gapId, value]) => {
            const key = `candidate_answers:${testId}:${skill}:gap:${gapId}`;
            writeToStorages(key, String(value ?? ''));
        });

        const mcq = answers.mcq || {};
        Object.entries(mcq).forEach(([keyId, value]) => {
            const parts = String(keyId).split(':');
            const blockId = parts[0];
            const questionId = parts[1];
            if (!blockId || !questionId) return;
            const key = `candidate_answers:${testId}:listening:mcq:${blockId}:${questionId}`;
            writeToStorages(key, JSON.stringify(value));
        });

        const matching = answers.matching || {};
        Object.entries(matching).forEach(([blockId, matches]) => {
            const key = `candidate_answers:${testId}:listening:matching:${blockId}`;
            writeToStorages(key, JSON.stringify(matches));
        });

        const tfng = answers.tfng || {};
        Object.entries(tfng).forEach(([keyId, value]) => {
            const parts = String(keyId).split(':');
            const blockId = parts[0];
            const questionId = parts[1];
            if (!blockId || !questionId) return;
            const key = `candidate_answers:${testId}:tfng:${blockId}:${questionId}`;
            writeToStorages(key, String(value ?? ''));
        });

        const writing = answers.writing || {};
        Object.entries(writing).forEach(([taskKey, value]) => {
            const key = `candidate_answers:${testId}:writing:${taskKey}`;
            writeToStorages(key, String(value ?? ''));
        });
    });
}

export function hydrateAnswersFromLocal() {
    if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key) continue;
            if (key.startsWith('candidate_answers:') || (key.startsWith('test_') && key.includes(':'))) {
                if (sessionStorage.getItem(key) === null) {
                    const value = localStorage.getItem(key);
                    if (value !== null && value !== undefined) {
                        sessionStorage.setItem(key, value);
                    }
                }
            }
        }
    } catch (e) {
        console.warn('[answers] hydrateAnswersFromLocal failed:', e);
    }
}

function safeJsonParse(value) {
    if (typeof value !== 'string') return value;
    try {
        return JSON.parse(value);
    } catch {
        return value;
    }
}

// Skill inference removed - skill must be explicitly provided
// Do not infer skill from testId to avoid ambiguity

/**
 * Canonical save function - all answer writes must go through this
 * @param {Object} params
 * @param {string} params.skill - Required: 'listening', 'reading', 'writing', 'speaking'
 * @param {string} params.testId - Required: test identifier
 * @param {string} params.type - Required: 'gap', 'mcq', 'tfng', 'matching', 'writing', 'speaking'
 * @param {string} params.id - Required: answer identifier (e.g., gapId, blockId:questionId)
 * @param {any} params.value - Answer value
 */
export function saveAnswer({ skill, testId, type, id, value }) {
    if (isLocked()) return;
    
    // Validate required parameters
    if (!skill || !testId || !type || !id) {
        console.error('[answers] saveAnswer requires skill, testId, type, and id');
        return;
    }
    
    // Normalize skill
    const normalizedSkill = String(skill).toLowerCase();
    const validSkills = ['listening', 'reading', 'writing', 'speaking'];
    if (!validSkills.includes(normalizedSkill)) {
        console.error(`[answers] Invalid skill: ${skill}`);
        return;
    }
    
    // Build canonical key structure
    const key = `canonical:${normalizedSkill}:${testId}:${type}:${id}`;
    const storageValue = (type === 'mcq' || type === 'matching') 
        ? JSON.stringify(value) 
        : String(value ?? '');
    
    writeToStorages(key, storageValue);
    queueProgressSync();
}

/**
 * Canonical get function - retrieves answer from canonical format
 * @param {Object} params
 * @param {string} params.skill - Required
 * @param {string} params.testId - Required
 * @param {string} params.type - Required
 * @param {string} params.id - Required
 * @returns {any} Answer value or null
 */
export function getAnswer({ skill, testId, type, id }) {
    if (!skill || !testId || !type || !id) {
        console.error('[answers] getAnswer requires skill, testId, type, and id');
        return null;
    }
    
    const normalizedSkill = String(skill).toLowerCase();
    const key = `canonical:${normalizedSkill}:${testId}:${type}:${id}`;
    const raw = readFromStorages(key);
    
    if (!raw) return (type === 'mcq' || type === 'matching') ? null : '';
    
    if (type === 'mcq' || type === 'matching') {
        try {
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }
    
    return raw;
}

function ensureSkillPayload(skills, skill, testId, blocksSnapshot) {
    if (!skills[skill]) {
        skills[skill] = {
            testId,
            answers: {
                gap: {},
                mcq: {},
                matching: {},
                tfng: {},
                writing: {},
                speaking: {}
            }
        };
        if (blocksSnapshot) {
            skills[skill].blocksSnapshot = blocksSnapshot;
        }
    }
    return skills[skill];
}

function addAnswer(skills, skill, testId, type, key, value, blocksSnapshot) {
    if (!skill) return;
    const payload = ensureSkillPayload(skills, skill, testId, blocksSnapshot);
    if (!payload.answers[type]) payload.answers[type] = {};
    payload.answers[type][key] = value;
}

function parseAnswerEntry(skills, key, value, ctx) {
    const rawValue = safeJsonParse(value);
    const skillSet = new Set(['listening', 'reading', 'writing', 'speaking']);

    // ONLY canonical format: canonical:skill:testId:type:id
    if (typeof key === 'string' && key.startsWith('canonical:')) {
        const parts = key.split(':');
        // parts: ['canonical', skill, testId, type, ...idParts]
        if (parts.length < 5) {
            console.warn(`[answers] Malformed canonical key: ${key}`);
            return;
        }
        
        const skill = parts[1];
        const testId = parts[2];
        const type = parts[3];
        const idKey = parts.slice(4).join(':');
        
        if (!skillSet.has(skill)) {
            console.warn(`[answers] Invalid skill in canonical key: ${skill}`);
            return;
        }
        
        const blocksSnapshot = ctx?.blocksSnapshotBySkill?.[skill] || ctx?.blocksSnapshot?.[skill] || null;
        addAnswer(skills, skill, testId, type, idKey, rawValue, blocksSnapshot);
        return;
    }

    // Legacy formats - warn but don't process
    if (typeof key === 'string' && key.startsWith('candidate_answers:')) {
        console.warn(`[answers] Legacy key format detected (candidate_answers): ${key}. Use saveAnswer() with canonical format.`);
        return;
    }
    
    if (typeof key === 'string' && key.startsWith('test_') && key.includes(':')) {
        console.warn(`[answers] Legacy key format detected (test_*): ${key}. Use saveAnswer() with canonical format.`);
        return;
    }
}

function readStoredAnswerEntries(callback) {
    const seen = new Set();
    if (typeof sessionStorage !== 'undefined') {
        for (let i = 0; i < sessionStorage.length; i++) {
            const key = sessionStorage.key(i);
            if (!key) continue;
            // Only read canonical format
            if (key.startsWith('canonical:')) {
                seen.add(key);
                callback(key, sessionStorage.getItem(key));
            }
        }
    }
    if (typeof localStorage !== 'undefined') {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key || seen.has(key)) continue;
            // Only read canonical format
            if (key.startsWith('canonical:')) {
                callback(key, localStorage.getItem(key));
            }
        }
    }
}

export function buildSkillsPayload(currentStateOrContext = {}) {
    const skills = {};

    const sourceMaps = [
        currentStateOrContext.answers,
        currentStateOrContext.answerMap,
        currentStateOrContext.responses
    ].filter(Boolean);

    sourceMaps.forEach(map => {
        Object.entries(map).forEach(([key, value]) => {
            if (typeof key === 'string' && (key.includes(':') || key.startsWith('candidate_answers:'))) {
                parseAnswerEntry(skills, key, value, currentStateOrContext);
            }
        });
    });

    readStoredAnswerEntries((key, value) => {
        parseAnswerEntry(skills, key, value, currentStateOrContext);
    });

    return skills;
}