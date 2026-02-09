// Enable autosave on tab/page close
export function enableDraftGuards() {
    // Save when user switches tab / closes page
    window.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') syncProgress();
    });
    window.addEventListener('pagehide', () => {
        syncProgress();
    });
}
// Build canonical skill answers from local draft format
export function buildSkillFromDraft({ scheduleId, rosterId, skill }) {
    const obj = getDraftAnswersObj({ scheduleId, rosterId, skill });
    const metaKey = getDraftMetaKey(scheduleId, rosterId, skill);
    let meta = {};
    try { meta = JSON.parse(localStorage.getItem(metaKey) || '{}'); } catch {}

    const answersByQid = obj.answersByQid || {};
    const answers = { gap: {}, mcq: {}, matching: {}, tfng: {}, writing: {}, speaking: {} };

    for (const [qid, val] of Object.entries(answersByQid)) {
        const [type, ...rest] = String(qid).split(':');
        const id = rest.join(':');
        if (!answers[type]) continue;
        answers[type][id] = val;
    }

    return { testId: meta.testId || null, answers };
}
// Answer locking functions
export function lockAnswers() {
    sessionStorage.setItem('answers_locked', 'true');
}

export function isLocked() {
    return sessionStorage.getItem('answers_locked') === 'true';
}

// All answer writes MUST go through saveAnswer() to ensure autosave to Firestore for cross-device resume.
// All legacy storage functions are now fully deprecated and removed.

// Deterministic key helpers
// All draft keys must include both scheduleId and rosterId (never reuse across candidates)
function getDraftKey(scheduleId, rosterId, skill) {
    if (!scheduleId || !rosterId) throw new Error('Draft key requires scheduleId and rosterId');
    return `draft_answers:${scheduleId}:${rosterId}:${skill}`;
}
function getDraftMetaKey(scheduleId, rosterId, skill) {
    if (!scheduleId || !rosterId) throw new Error('Draft meta key requires scheduleId and rosterId');
    return `draft_meta:${scheduleId}:${rosterId}:${skill}`;
}


function writeDraftAnswer({ scheduleId, rosterId, skill, qid, value }) {
    if (!scheduleId || !rosterId || !skill || !qid) return;
    const key = getDraftKey(scheduleId, rosterId, skill);
    let obj = {};
    try {
        obj = JSON.parse(localStorage.getItem(key) || '{}');
    } catch {}
    obj.answersByQid = obj.answersByQid || {};
    obj.answersByQid[qid] = value;
    obj.updatedAtMs = Date.now();
    localStorage.setItem(key, JSON.stringify(obj));
}

function writeDraftMeta({ scheduleId, rosterId, skill, testId }) {
    if (!scheduleId || !rosterId || !skill || !testId) return;
    const metaKey = getDraftMetaKey(scheduleId, rosterId, skill);
    const meta = {
        testId,
        updatedAtMs: Date.now()
    };
    try {
        localStorage.setItem(metaKey, JSON.stringify(meta));
    } catch {}
}

function readDraftAnswer({ scheduleId, rosterId, skill, qid }) {
    if (!scheduleId || !rosterId || !skill || !qid) return undefined;
    const key = getDraftKey(scheduleId, rosterId, skill);
    try {
        const obj = JSON.parse(localStorage.getItem(key) || '{}');
        return obj.answersByQid ? obj.answersByQid[qid] : undefined;
    } catch {
        return undefined;
    }
}

function getDraftAnswersObj({ scheduleId, rosterId, skill }) {
    if (!scheduleId || !rosterId || !skill) return {};
    const key = getDraftKey(scheduleId, rosterId, skill);
    try {
        return JSON.parse(localStorage.getItem(key) || '{}');
    } catch {
        return {};
    }
}
function sanitizeForId(value) {
    return String(value || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
}

export function ensureAttemptId() {
    // Use Option B: att_{scheduleId}_{rosterId} for attemptId, matching db.attempts.js
    const rosterId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
    const scheduleId = sessionStorage.getItem('candidate_schedule_id');
    if (!rosterId || !scheduleId) return null;
    const attemptId = `att_${sanitizeForId(scheduleId)}_${sanitizeForId(rosterId)}`;
    const storageKey = `test_attempt_id:${rosterId}:${scheduleId}`;
    sessionStorage.setItem(storageKey, attemptId);
    try {
        if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, attemptId);
    } catch (e) {
        console.warn('[answers] localStorage attemptId write failed:', e);
    }
    return attemptId;
}

let __syncTimer = null;

export async function syncProgress() {
    const attemptId = ensureAttemptId();
    if (!attemptId) return;
    try {
        const { upsertAttemptProgress, upsertAttemptSkill } = await import('../../db/db.attempts.js');
        const candidateId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
        const scheduleId = sessionStorage.getItem('candidate_schedule_id');
        const examId = sessionStorage.getItem('candidate_exam_id');
        const candidateName = sessionStorage.getItem('candidate_full_name') || '';
        const testerId = sessionStorage.getItem('candidate_tester_id') || '';

        await upsertAttemptProgress({
            attemptId,
            candidateId,
            scheduleId,
            examId,
            candidateName,
            testerId,
            status: 'in_progress'
        });

        // push draft answers per-skill
        for (const skill of ['listening','reading','writing','speaking']) {
            const payload = buildSkillFromDraft({ scheduleId, rosterId: candidateId, skill });
            const answers = payload?.answers || {};
            const testId = payload?.testId || null;
            const hasAny = Object.values(answers).some(m => m && Object.keys(m).length);
            if (hasAny) {
                await upsertAttemptSkill(attemptId, skill, { testId, answers }); // ✅ include testId
            }
        }
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
    // Use deterministic localStorage draft key
    const scheduleId = sessionStorage.getItem('candidate_schedule_id');
    const rosterId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
    if (!scheduleId || !rosterId) return;
    // store as "type:id" so we can rebuild canonical answers maps
    writeDraftAnswer({ scheduleId, rosterId, skill, qid: `${type}:${id}`, value });
    // also store meta once
    writeDraftMeta({ scheduleId, rosterId, skill, testId });
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

    const scheduleId = sessionStorage.getItem('candidate_schedule_id');
    const rosterId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
    if (!scheduleId || !rosterId) return null;

    const draftKey = `draft_answers:${scheduleId}:${rosterId}:${skill}`;
    let obj = {};
    try { obj = JSON.parse(localStorage.getItem(draftKey) || '{}'); } catch {}

    // ✅ MUST match saveAnswer(): `${type}:${id}`
    const qid = `${type}:${id}`;
    const value = obj.answersByQid ? obj.answersByQid[qid] : undefined;

    if (value === undefined || value === null) {
        return (type === 'mcq' || type === 'matching') ? null : '';
    }

    // If mcq/matching stored as object, return it directly; if string, try parse
    if (type === 'mcq' || type === 'matching') {
        try {
            return typeof value === 'string' ? JSON.parse(value) : value;
        } catch {
            return null;
        }
    }

    return value;
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

    // ONLY canonical format: canonical:attemptId:skill:testId:type:id
    if (typeof key === 'string' && key.startsWith('canonical:')) {
        const parts = key.split(':');
        // parts: ['canonical', attemptId, skill, testId, type, ...idParts]
        if (parts.length < 6) {
            // Ignore old canonical keys (legacy)
            console.warn(`[answers] Malformed or legacy canonical key: ${key}`);
            return;
        }
        const attemptId = parts[1];
        const skill = parts[2];
        const testId = parts[3];
        const type = parts[4];
        const idKey = parts.slice(5).join(':');
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
    const scheduleId = sessionStorage.getItem('candidate_schedule_id');
    const rosterId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
    const skillList = ['listening', 'reading', 'writing', 'speaking'];

    // Prefer local drafts if present
    if (scheduleId && rosterId) {
        for (const skill of skillList) {
            const obj = getDraftAnswersObj({ scheduleId, rosterId, skill });
            if (obj && obj.answersByQid && Object.keys(obj.answersByQid).length > 0) {
                skills[skill] = buildSkillFromDraft({ scheduleId, rosterId, skill });
            }
        }
    }

    // Fallback to legacy/canonical sources if no draft for a skill
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