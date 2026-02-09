import { db } from '../core/firebase.js';
import {
    collection,
    doc,
    addDoc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
    Timestamp,
    onSnapshot,
    arrayUnion,
    arrayRemove,
    runTransaction
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// --- Constants ---
const COLL_CANDIDATES = 'candidates';
const COLL_SCHEDULES = 'schedules';
const SUB_ROSTER = 'roster';
const SUB_EVENTS = 'events';

// --- Helpers ---

/**
 * Audit Log Helper: Appends an event to the schedule's event subcollection.
 * Best effort (catch errors silently to not block main flow).
 */
export async function appendScheduleEvent(scheduleId, type, payload) {
    try {
        const eventsRef = collection(db, COLL_SCHEDULES, scheduleId, SUB_EVENTS);
        await addDoc(eventsRef, {
            type,
            payload: payload || {},
            occurredAt: serverTimestamp()
        });
    } catch (err) {
        console.warn('Failed to write audit log:', err);
    }
}

/**
 * Helper to ensure a value is a Firestore Timestamp
 */
const toTimestamp = (dateInput) => {
    if (!dateInput) return null;
    if (dateInput instanceof Timestamp) return dateInput;
    return Timestamp.fromDate(new Date(dateInput));
};

// --- CANDIDATES ---

export function generateTesterId() {
    // Generates a random 6-char uppercase alphanumeric string (ex: "K9X2B1")
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I, O, 0, 1 for readability
    let result = '';
    for (let i = 0; i < 6; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

export async function createCandidate({ fullName, dob, className, testerId }) {
    if (!fullName || !dob || !className) throw new Error("Missing required candidate fields");

    // Generate or validate testerId with uniqueness check
    let finalTesterId = testerId;
    if (!finalTesterId) {
        finalTesterId = generateTesterId();
    }

    // Attempt to ensure uniqueness (up to 5 tries)
    let attempts = 0;
    let isUnique = false;
    
    while (!isUnique && attempts < 5) {
        const q = query(
            collection(db, COLL_CANDIDATES),
            where('testerId', '==', finalTesterId),
            limit(1)
        );
        const snap = await getDocs(q);
        
        if (snap.empty) {
            isUnique = true;
        } else {
            finalTesterId = generateTesterId();
            attempts++;
        }
    }

    if (!isUnique) {
        throw new Error("Unable to generate unique Tester ID after multiple attempts. Please try again.");
    }

    // --- Deterministic candidate ID generation ---
    // Format: cand_<yyyy>_<class>_<seq>
    const now = new Date();
    const yyyy = String(now.getFullYear());
    const classSlug = String(className).toLowerCase().replace(/\s+/g, '_');

    // Query existing candidates for the same year and class
    const idPattern = new RegExp(`^cand_${yyyy}_${classSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_(0*[0-9]+)$`);
    const allCandidates = await getDocs(collection(db, COLL_CANDIDATES));
    
    let sameYearClassCount = 0;
    allCandidates.docs.forEach(d => {
        if (typeof d.id === 'string' && idPattern.test(d.id)) {
            sameYearClassCount++;
        }
    });

    const seqNum = sameYearClassCount + 1;
    const seqStr = String(seqNum).padStart(3, '0'); // 001, 002, 003...
    const candidateId = `cand_${yyyy}_${classSlug}_${seqStr}`;

    const newCandidate = {
        fullName,
        dob, // Expecting YYYY-MM-DD string
        className,
        testerId: finalTesterId,
        assignedScheduleIds: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    // Persist candidate using setDoc with deterministic ID
    const candidateRef = doc(db, COLL_CANDIDATES, candidateId);
    await setDoc(candidateRef, newCandidate);
    
    return { id: candidateId, ...newCandidate };
}

export async function updateCandidate(candidateId, patchObj) {
    if (!candidateId) throw new Error("Candidate ID required");
    const ref = doc(db, COLL_CANDIDATES, candidateId);
    
    // cleanup undefined
    const cleanPatch = { ...patchObj, updatedAt: serverTimestamp() };
    Object.keys(cleanPatch).forEach(key => cleanPatch[key] === undefined && delete cleanPatch[key]);

    await updateDoc(ref, cleanPatch);
}

export async function deleteCandidate(candidateId) {
    if (!candidateId) throw new Error("Candidate ID required");
    await deleteDoc(doc(db, COLL_CANDIDATES, candidateId));
}

export async function getCandidate(candidateId) {
    const snap = await getDoc(doc(db, COLL_CANDIDATES, candidateId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export async function listCandidates({ searchText } = {}) {
    // Firestore lacks native substring search. 
    // We fetch a batch (ordered by created desc) and filter client-side.
    const q = query(collection(db, COLL_CANDIDATES), orderBy('createdAt', 'desc'), limit(200));
    const snap = await getDocs(q);
    
    let results = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (searchText) {
        const lowerSearch = searchText.toLowerCase();
        results = results.filter(c => 
            (c.fullName && c.fullName.toLowerCase().includes(lowerSearch)) ||
            (c.testerId && c.testerId.toLowerCase().includes(lowerSearch))
        );
    }
    return results;
}

// --- SCHEDULES ---

export async function createSchedule({ title, startAt, endAt, durationMs, examId }) {
    if (!title || !startAt || !endAt) throw new Error("Missing required schedule fields");

    // Deterministic session ID: sess_<examId>_<yyyymmdd>_<hhmm>
    const startDate = new Date(startAt);
    if (!examId) throw new Error("examId is required for deterministic session IDs");
    if (isNaN(startDate.getTime())) throw new Error("Invalid startAt date");

    const pad2 = (n) => String(n).padStart(2, '0');

    // Use LOCAL date/time (avoids UTC day-shift)
    const yyyymmdd = `${startDate.getFullYear()}${pad2(startDate.getMonth() + 1)}${pad2(startDate.getDate())}`;
    const hhmm = `${pad2(startDate.getHours())}${pad2(startDate.getMinutes())}`;

    const baseId = `sess_${examId}_${yyyymmdd}_${hhmm}`;
    // Collision-proof: if baseId exists, append _02, _03...
    let sessionId = baseId;
    let attempt = 1;
    while (true) {
      const existsSnap = await getDoc(doc(db, COLL_SCHEDULES, sessionId));
      if (!existsSnap.exists()) break;
      attempt += 1;
      if (attempt > 99) throw new Error("Too many sessions at the same start time; adjust minutes.");
      sessionId = `${baseId}_${pad2(attempt)}`;
    }

    const newSchedule = {
        title,
        startAt: toTimestamp(startAt),
        endAt: toTimestamp(endAt),
        status: 'upcoming',
        liveStartedAt: null,
        durationMs: Number(durationMs) || 0,
        extraTimeMs: 0,
        paused: false,
        endedAt: null,
        examId: examId || null,
        examTitleSnapshot: null,
        examComponentsSnapshot: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        date: yyyymmdd,
        time: hhmm,
        auditNextSeq: 1
    };


// --- Audit Log Helper: Appends an event to the schedule's event subcollection with deterministic IDs. ---
// Uses a transaction to reserve the next sequence number.
// (Duplicate definition removed to fix error)

        // If examId provided, load exam and populate snapshots
        if (examId) {
            try {
                const examDoc = await getDoc(doc(db, 'exams', examId));
                if (examDoc.exists()) {
                    const examData = examDoc.data();
                    newSchedule.examTitleSnapshot = examData.title || '';
                    newSchedule.examComponentsSnapshot = examData.components || [];
                }
            } catch (err) {
                console.warn('Failed to load exam snapshot for schedule:', err);
            }
        }

    // Save the schedule document
    const docRef = doc(db, COLL_SCHEDULES, sessionId);
    await setDoc(docRef, newSchedule);

    return { id: docRef.id, ...newSchedule };
}

export async function setScheduleExam(scheduleId, examId) {
    try {
        const examDoc = await getDoc(doc(db, 'exams', examId));
        if (!examDoc.exists()) throw new Error("Exam not found");

        const examData = examDoc.data();
        const ref = doc(db, COLL_SCHEDULES, scheduleId);
        
        const updates = {
            examId,
            examTitleSnapshot: examData.title || '',
            examComponentsSnapshot: examData.components || [],
            updatedAt: serverTimestamp()
        };

        await updateDoc(ref, updates);
        await appendScheduleEvent(scheduleId, 'SCHEDULE_EXAM_SET', { examId, examTitle: examData.title });
    } catch (err) {
        console.error('Error setting schedule exam:', err);
        throw err;
    }
}

export async function updateSchedule(scheduleId, patchObj) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    const cleanPatch = { ...patchObj, updatedAt: serverTimestamp() };
    
    if (cleanPatch.startAt) cleanPatch.startAt = toTimestamp(cleanPatch.startAt);
    if (cleanPatch.endAt) cleanPatch.endAt = toTimestamp(cleanPatch.endAt);

    await updateDoc(ref, cleanPatch);
    await appendScheduleEvent(scheduleId, 'SCHEDULE_UPDATED', patchObj);
}

export async function deleteSchedule(scheduleId) {
    // NOTE: This does NOT delete the subcollections (roster/events).
    // In a production environment, use a Cloud Function triggered on delete, 
    // or a Recursive Delete helper. Leaving subcollections is standard Firestore 
    // behavior for client SDKs.
    await deleteDoc(doc(db, COLL_SCHEDULES, scheduleId));
}

export async function getSchedule(scheduleId) {
    const snap = await getDoc(doc(db, COLL_SCHEDULES, scheduleId));
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
}

export async function listSchedules({ status } = {}) {
    let q = query(collection(db, COLL_SCHEDULES), orderBy('startAt', 'desc'));
    
    if (status) {
        q = query(q, where('status', '==', status));
    }
    
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- ASSIGNMENTS (ROSTER) ---

export async function assignCandidateToSchedule(scheduleId, candidate) {
    if (!scheduleId || !candidate || !candidate.id) throw new Error("Invalid params for assignment");
    
    // Load schedule to get exam snapshots
    let examId = null;
    let examTitleSnapshot = null;
    let examComponentsSnapshot = [];

    try {
        const scheduleSnap = await getDoc(doc(db, COLL_SCHEDULES, scheduleId));
        if (scheduleSnap.exists()) {
            const schedData = scheduleSnap.data();
            examId = schedData.examId || null;
            examTitleSnapshot = schedData.examTitleSnapshot || null;
            examComponentsSnapshot = schedData.examComponentsSnapshot || [];
        }
    } catch (err) {
        console.warn('Failed to load schedule exam info:', err);
    }
    
    const rosterRef = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidate.id);
    
    const rosterEntry = {
        candidateId: candidate.id,
        testerId: candidate.testerId || '',
        fullNameSnapshot: candidate.fullName || '',
        dobSnapshot: candidate.dob || '',
        classSnapshot: candidate.className || '',
        examId: examId,
        examTitleSnapshot: examTitleSnapshot,
        examComponentsSnapshot: examComponentsSnapshot,
        seat: '',
        status: 'assigned',
        candidateStatus: 'not_started',
        extraTimeMs: 0,
        submittedAt: null,
        lastHeartbeatAt: null,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    };

    await setDoc(rosterRef, rosterEntry);
    
    // Update candidate document to track assignment
    const candidateRef = doc(db, COLL_CANDIDATES, candidate.id);
    await updateDoc(candidateRef, {
        assignedScheduleIds: arrayUnion(scheduleId),
        updatedAt: serverTimestamp()
    });
    
    await appendScheduleEvent(scheduleId, 'CANDIDATE_ASSIGNED', { candidateId: candidate.id, name: candidate.fullName });
}

export async function unassignCandidateFromSchedule(scheduleId, candidateId) {
    await deleteDoc(doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId));
    
    // Update candidate document to remove assignment
    const candidateRef = doc(db, COLL_CANDIDATES, candidateId);
    await updateDoc(candidateRef, {
        assignedScheduleIds: arrayRemove(scheduleId),
        updatedAt: serverTimestamp()
    });
    
    await appendScheduleEvent(scheduleId, 'CANDIDATE_UNASSIGNED', { candidateId });
}

export async function listRoster(scheduleId) {
    const q = query(
        collection(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER),
        orderBy('fullNameSnapshot')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// --- SESSION ACTIONS ---

export async function startScheduleNow(scheduleId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    const updates = {
        status: 'live',
        liveStartedAt: serverTimestamp(),
        paused: false,
        updatedAt: serverTimestamp()
    };
    await updateDoc(ref, updates);
    await appendScheduleEvent(scheduleId, 'SESSION_STARTED', {});
}

export async function endScheduleNow(scheduleId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    const updates = {
        status: 'ended',
        endedAt: serverTimestamp(),
        paused: false,
        updatedAt: serverTimestamp()
    };
    await updateDoc(ref, updates);
    await appendScheduleEvent(scheduleId, 'SESSION_ENDED', {});
}

export async function pauseSchedule(scheduleId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    await updateDoc(ref, { paused: true, updatedAt: serverTimestamp() });
    await appendScheduleEvent(scheduleId, 'SESSION_PAUSED', {});
}

export async function resumeSchedule(scheduleId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    await updateDoc(ref, { paused: false, updatedAt: serverTimestamp() });
    await appendScheduleEvent(scheduleId, 'SESSION_RESUMED', {});
}

export async function addScheduleTime(scheduleId, deltaMs) {
    // Requires reading first to add to existing extraTimeMs
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Schedule not found");
    
    const currentExtra = snap.data().extraTimeMs || 0;
    const newExtra = Math.max(0, currentExtra + deltaMs); // Prevent negative extra time

    await updateDoc(ref, { 
        extraTimeMs: newExtra, 
        updatedAt: serverTimestamp() 
    });
    
    await appendScheduleEvent(scheduleId, 'SESSION_TIME_ADDED', { deltaMs, newTotal: newExtra });
}

// --- CANDIDATE LEVEL ACTIONS ---

export async function setRosterStatus(scheduleId, candidateId, status) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    await updateDoc(ref, { 
        status: status, 
        updatedAt: serverTimestamp() 
    });
    // Log meaningful changes
    if (status === 'checked_in') {
        await appendScheduleEvent(scheduleId, 'CANDIDATE_CHECKED_IN', { candidateId });
    }
}

export async function setCandidateStatus(scheduleId, candidateId, candidateStatus) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    await updateDoc(ref, { 
        candidateStatus: candidateStatus, 
        updatedAt: serverTimestamp() 
    });
}

export async function markCandidateSubmitted(scheduleId, candidateId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    await updateDoc(ref, {
        candidateStatus: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    await appendScheduleEvent(scheduleId, 'CANDIDATE_SUBMITTED', { candidateId });
}

export async function addCandidateTime(scheduleId, candidateId, deltaMs) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    const snap = await getDoc(ref);
    if (!snap.exists()) throw new Error("Roster entry not found");

    const currentExtra = snap.data().extraTimeMs || 0;
    const newExtra = Math.max(0, currentExtra + deltaMs);

    await updateDoc(ref, { 
        extraTimeMs: newExtra, 
        updatedAt: serverTimestamp() 
    });
    
    await appendScheduleEvent(scheduleId, 'CANDIDATE_TIME_ADDED', { candidateId, deltaMs });
}

export async function forceSubmitCandidate(scheduleId, candidateId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    await updateDoc(ref, {
        candidateStatus: 'submitted',
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
    await appendScheduleEvent(scheduleId, 'CANDIDATE_FORCE_SUBMITTED', { candidateId });
}

export async function unlockCandidate(scheduleId, candidateId) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER, candidateId);
    await updateDoc(ref, {
        candidateStatus: 'in_progress',
        updatedAt: serverTimestamp()
        // We do not clear submittedAt strictly, as audit history might be useful, 
        // but status overrides behavior.
    });
    await appendScheduleEvent(scheduleId, 'CANDIDATE_UNLOCKED', { candidateId });
}

// --- REALTIME OBSERVERS ---

export function observeSchedules(callback, { status } = {}) {
    let q = query(collection(db, COLL_SCHEDULES), orderBy('startAt', 'desc'));
    if (status) {
        q = query(q, where('status', '==', status));
    }

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    }, (error) => {
        console.error("Error observing schedules:", error);
    });
}

export function observeRoster(scheduleId, callback) {
    const q = query(
        collection(db, COLL_SCHEDULES, scheduleId, SUB_ROSTER),
        orderBy('fullNameSnapshot')
    );

    return onSnapshot(q, (snapshot) => {
        const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        callback(data);
    }, (error) => {
        console.error(`Error observing roster for ${scheduleId}:`, error);
    });
}

export function observeSchedule(scheduleId, callback) {
    const ref = doc(db, COLL_SCHEDULES, scheduleId);
    return onSnapshot(ref, (docSnap) => {
        if (docSnap.exists()) {
            callback({ id: docSnap.id, ...docSnap.data() });
        } else {
            callback(null);
        }
    }, (error) => {
        console.error(`Error observing schedule ${scheduleId}:`, error);
    });
}