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
function generateAttemptId(candidateId, candidateName, examId) {
    const timestamp = Date.now();
    const sanitizedCandidateId = String(candidateId || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedCandidateName = String(candidateName || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    const sanitizedExamId = String(examId || 'unknown').replace(/[^a-zA-Z0-9]/g, '_');
    return `${sanitizedCandidateId}_${sanitizedCandidateName}_${sanitizedExamId}_${timestamp}`;
}

export async function createAttempt(payload = {}) {
    try {
        // Generate deterministic document ID (allow override)
        const attemptId = payload.attemptId || generateAttemptId(payload.candidateId, payload.candidateName, payload.examId);
        
        const attemptData = {
            candidateId: payload.candidateId || null,
            scheduleId: payload.scheduleId || null,
            examId: payload.examId || null,
            testerId: payload.testerId || null,
            candidateName: payload.candidateName || null,
            answers: payload.answers || null,
            skills: payload.skills || null,
            status: payload.status || "submitted",
            submittedAt: payload.submittedAt || serverTimestamp()
        };

        await setDoc(doc(db, ATTEMPTS_COL, attemptId), attemptData);
        return { id: attemptId };
    } catch (e) {
        console.error("Error creating attempt:", e);
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
            skills: payload.skills || null,
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

export function hasSkill(attempt, skill) {
    if (!attempt || !skill) return false;
    const key = String(skill || '').toLowerCase();
    return !!attempt.skills && Object.prototype.hasOwnProperty.call(attempt.skills, key);
}

export function getAttemptSkill(attempt, skill) {
    if (!attempt || !skill) return null;
    const key = String(skill || '').toLowerCase();
    return attempt.skills ? attempt.skills[key] || null : null;
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
            results = results.filter(a => hasSkill(a, skill));
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

    try {
        const skill = String(autoScorePayload.skill).toLowerCase();
        
        // Use dot-path notation to update only the specific skill's auto-score
        // This preserves grading.manual and grading.auto for other skills
        const updatePayload = {
            [`grading.auto.${skill}`]: autoScorePayload,
            'grading.autoUpdatedAt': serverTimestamp()
        };

        await updateAttempt(attemptId, updatePayload);
        return { ok: true };
    } catch (e) {
        console.error('Error saving auto-score:', e);
        throw e;
    }
}