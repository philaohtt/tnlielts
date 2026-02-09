import { db } from "../core/firebase.js";
import { 

// filepath: c:\Users\GA\OneDrive\Teach and Learn\Admin\IELTS app html\db.attempts.js
    collection, doc, setDoc, serverTimestamp, getDocs, query, orderBy, getDoc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const ATTEMPTS_COL = 'attempts';

/**
 * Generate attempt document ID using naming rule:
 * Format: {candidateId}_{candidateName}_{examId}_{timestamp}
 * Example: AR4JDN_Hoang_Thanh_Tung_exam_writing_1_1738627067847
 */

function sanitizeIdPart(v) {
    return String(v || 'unknown').trim().replace(/[^a-zA-Z0-9]/g, '_');
}

/**
 * Attempt docID rule (Option B):
 *   att_{scheduleId}_{candidateId}[_NN]
 * - base: att_{scheduleId}_{candidateId}
 * - if already exists and you need a new sitting: _02, _03...
 *
 * Note: scheduleId is the session/schedule docID (your system uses scheduleId field).
 */
async function generateAttemptId(scheduleId, candidateId, mode = 'reuse_if_in_progress') {
    const sch = sanitizeIdPart(scheduleId);
    const cand = sanitizeIdPart(candidateId);
    const baseId = `att_${sch}_${cand}`;

    // 1) If base doesn't exist → use it
    const baseRef = doc(db, ATTEMPTS_COL, baseId);
    const baseSnap = await getDoc(baseRef);
    if (!baseSnap.exists()) return baseId;

    // 2) If base exists and mode is reuse_if_in_progress → reuse if in_progress
    if (mode === 'reuse_if_in_progress') {
        const status = String(baseSnap.data()?.status || '').toLowerCase();
        if (status === 'in_progress') return baseId;
    }

    // 3) Otherwise create a new sitting _02..._99
    const pad2 = (n) => String(n).padStart(2, '0');
    for (let i = 2; i <= 99; i++) {
        const tryId = `${baseId}_${pad2(i)}`;
        const trySnap = await getDoc(doc(db, ATTEMPTS_COL, tryId));
        if (!trySnap.exists()) return tryId;
    }

    throw new Error('Too many attempts for this candidate in this session. Please adjust policy.');
}


export async function createAttempt(payload = {}) {
    try {
        if (!payload.scheduleId) throw new Error('scheduleId is required');
        if (!payload.candidateId) throw new Error('candidateId is required');

        // Option B deterministic id; reuse in-progress attempt when appropriate
        const attemptId =
            payload.attemptId ||
            await generateAttemptId(payload.scheduleId, payload.candidateId, 'reuse_if_in_progress');

        const attemptData = {
            attemptId,
            candidateId: payload.candidateId || null,
            scheduleId: payload.scheduleId || null,
            examId: payload.examId || null,
            testerId: payload.testerId || null,
            candidateName: payload.candidateName || null,
            // Option B: parent doc stores meta only
            status: payload.status || 'in_progress',
            startedAt: payload.startedAt || serverTimestamp(),
            submittedAt: payload.submittedAt || null,
            updatedAt: serverTimestamp()
        };

        // Use merge so calling createAttempt again doesn't wipe fields
        await setDoc(doc(db, ATTEMPTS_COL, attemptId), attemptData, { merge: true });

        return { id: attemptId, attemptId };
    } catch (e) {
        console.error('Error creating attempt:', e);
        throw e;
    }
}

export async function upsertAttemptProgress(payload = {}) {
    const attemptId = payload.attemptId;
    if (!attemptId) throw new Error('attemptId is required');
    try {
        const attemptData = {
            candidateId: payload.candidateId || null,
            scheduleId: payload.scheduleId || null,
            examId: payload.examId || null,
            testerId: payload.testerId || null,
            candidateName: payload.candidateName || null,
            status: payload.status || 'in_progress',
            updatedAt: serverTimestamp()
        };
        await setDoc(doc(db, ATTEMPTS_COL, attemptId), attemptData, { merge: true });
        return { id: attemptId };
    } catch (e) {
        console.error('Error upserting attempt progress:', e);
        throw e;
    }
}


function normalizeSkill(skill) {
    return String(skill || '').trim().toLowerCase();
}

function skillDocRef(attemptId, skill) {
    const s = normalizeSkill(skill);
    if (!['listening', 'reading', 'writing', 'speaking'].includes(s)) {
        throw new Error(`Invalid skill: ${skill}`);
    }
    return doc(db, ATTEMPTS_COL, attemptId, 'skills', s);
}

/**
 * Option B: upsert answers for one skill
 * attempt/{attemptId}/skills/{skill}
 */
export async function upsertAttemptSkill(attemptId, skill, payload = {}) {
    if (!attemptId) throw new Error('attemptId is required');
    const s = normalizeSkill(skill);

    const data = {
        skill: s,
        answers: payload.answers || {},     // normalized canonical answers
        autoscore: payload.autoscore || null,
        manual: payload.manual || null,
        updatedAt: serverTimestamp()
    };

        await setDoc(skillDocRef(attemptId, s), data, { merge: true });
        // Also set skillFlags on root for filtering
        await setDoc(doc(db, ATTEMPTS_COL, attemptId), {
            skillFlags: { [s]: true },
            updatedAt: serverTimestamp()
        }, { merge: true });
        return { ok: true };
}

/**
 * Load one skill doc
 */
export async function getAttemptSkillDoc(attemptId, skill) {
    if (!attemptId) throw new Error('attemptId is required');
    const s = normalizeSkill(skill);

    const snap = await getDoc(skillDocRef(attemptId, s));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

// Option B async versions
export async function hasSkill(attemptId, skill) {
    const docData = await getAttemptSkillDoc(attemptId, skill);
    return !!docData;
}

export async function getAttemptSkill(attemptId, skill) {
    return await getAttemptSkillDoc(attemptId, skill);
}

export async function listAttempts(filters = {}) {
    try {
        const q = query(collection(db, ATTEMPTS_COL), orderBy('submittedAt', 'desc'));
        const snapshot = await getDocs(q);
        let results = snapshot.docs.map(d => ({ id: d.id, attemptId: d.id, ...d.data() }));

        const { status, examId, scheduleId, skill } = filters || {};
        if (status) {
            const s = String(status).toLowerCase();
            results = results.filter(a => String(a.status || '').toLowerCase() === s);
        }
        if (examId) {
            results = results.filter(a => String(a.examId || '') === String(examId));
        }
        if (scheduleId) {
            results = results.filter(a => String(a.scheduleId || '') === String(scheduleId));
        }
        if (skill) {
            const s = String(skill).toLowerCase();
            results = results.filter(a => a.skillFlags && a.skillFlags[s]);
        }

        return results;
    } catch (e) {
        console.error('Error listing attempts:', e);
        throw e;
    }
}

export async function getAttemptById(attemptId) {
    if (!attemptId) throw new Error('attemptId is required');
    try {
        const snap = await getDoc(doc(db, ATTEMPTS_COL, attemptId));
        if (!snap.exists()) return null;
        return { id: snap.id, attemptId: snap.id, ...snap.data() };
    } catch (e) {
        console.error('Error loading attempt:', e);
        throw e;
    }
}

export async function updateAttempt(attemptId, patchObj = {}) {
    if (!attemptId) throw new Error('attemptId is required');
    try {
        const cleanPatch = { ...patchObj, updatedAt: serverTimestamp() };
        Object.keys(cleanPatch).forEach(key => cleanPatch[key] === undefined && delete cleanPatch[key]);
        await updateDoc(doc(db, ATTEMPTS_COL, attemptId), cleanPatch);
    } catch (e) {
        console.error('Error updating attempt:', e);
        throw e;
    }
}

/**
 * Save auto-score results for a specific skill to an attempt document.
 * Uses dot-path notation to avoid overwriting other grading data.
 * 
 * @param {string} attemptId - The attempt document ID
 * @param {object} autoScorePayload - Auto-score data with structure:
 *   { skill, computedAt, totalQuestions, correct, accuracy, byBlock, warnings }
 * @returns {Promise<{ok: boolean}>}
 */
export async function saveAutoScore(attemptId, autoScorePayload) {
  if (!attemptId) throw new Error('attemptId is required');
  if (!autoScorePayload || !autoScorePayload.skill) {
    throw new Error('autoScorePayload must contain skill property');
  }

  const s = String(autoScorePayload.skill).toLowerCase();
  await upsertAttemptSkill(attemptId, s, { autoscore: autoScorePayload });
  return { ok: true };
}