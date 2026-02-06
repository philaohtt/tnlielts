import { getSchedule, listRoster, setRosterStatus } from "../../db/db.proctor.js";
import { db } from "../../core/firebase.js";
import { doc, getDoc, getDocs, collection, query, where, limit } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

function normalizeName(s) {
    if (!s) return "";
    return s.trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, " ");
}

export async function findRosterEntryByCandidateId(candidateId) {
    if (!candidateId) return { ok: false, error: "Missing Candidate ID" };

    try {
        const candidateRef = doc(db, "candidates", candidateId);
        const candidateSnap = await getDoc(candidateRef);

        if (!candidateSnap.exists()) return { ok: false, error: "Candidate ID not found" };

        const matchedCandidate = candidateSnap.data();
        const candidateDocId = candidateSnap.id;
        const assignedScheduleIds = matchedCandidate.assignedScheduleIds || [];
        
        if (assignedScheduleIds.length === 0) return { ok: false, error: "Candidate is not assigned to any schedule" };

        let selectedScheduleId = null;
        let selectedSchedule = null;
        let foundSchedule = false;

        for (const scheduleId of assignedScheduleIds) {
            try {
                const schedule = await getSchedule(scheduleId);
                if (!schedule) continue;
                foundSchedule = true;
                const isOpen = schedule.status === 'live' && schedule.paused !== true && schedule.endedAt == null;
                if (isOpen) {
                    selectedScheduleId = scheduleId;
                    selectedSchedule = schedule;
                    break;
                }
            } catch (err) {
                console.warn(`Failed to load schedule ${scheduleId}:`, err);
            }
        }

        if (!selectedScheduleId || !selectedSchedule) {
            if (foundSchedule) return { ok: false, error: "Session not open. Please wait for the proctor to start the session." };
            return { ok: false, error: "No valid schedule found for candidate" };
        }

        const rosterRef = doc(db, "schedules", selectedScheduleId, "roster", candidateDocId);
        const rosterSnap = await getDoc(rosterRef);

        if (!rosterSnap.exists()) return { ok: false, error: "Candidate not found in schedule roster" };

        const rosterData = rosterSnap.data();

        return {
            ok: true,
            scheduleId: selectedScheduleId,
            rosterCandidateId: rosterSnap.id,
            schedule: {
                title: selectedSchedule.title || "",
                examId: selectedSchedule.examId || null,
                examTitleSnapshot: selectedSchedule.examTitleSnapshot || "",
                examComponentsSnapshot: selectedSchedule.examComponentsSnapshot || []
            },
            candidate: {
                candidateId: candidateDocId,
                fullNameSnapshot: rosterData.fullNameSnapshot || matchedCandidate.fullName || "",
                dobSnapshot: rosterData.dobSnapshot || matchedCandidate.dob || "",
                classSnapshot: rosterData.classSnapshot || matchedCandidate.className || "",
                testerId: matchedCandidate.testerId || ""
            }
        };

    } catch (err) {
        console.error("findRosterEntryByCandidateId error:", err);
        return { ok: false, error: "System error. Please contact proctor.", debug: err.message };
    }
}

export async function findRosterEntryByNameAndTesterId(fullName, testerId) {
    if (!fullName || !testerId) return { ok: false, error: "Missing Full Name or Tester ID" };

    try {
        const normName = normalizeName(fullName);
        const normTester = testerId.trim().toUpperCase();

        const candidatesRef = collection(db, "candidates");
        const q = query(candidatesRef, where("testerId", "==", normTester), limit(5));
        const candidatesSnap = await getDocs(q);

        if (candidatesSnap.empty) return { ok: false, error: "No matching candidate found" };

        let matchedCandidate = null;
        let candidateId = null;

        for (const candidateDoc of candidatesSnap.docs) {
            const candidateData = candidateDoc.data();
            const candidateName = normalizeName(candidateData.fullName || "");
            if (candidateName === normName) {
                matchedCandidate = candidateData;
                candidateId = candidateDoc.id;
                break;
            }
        }

        if (!matchedCandidate) return { ok: false, error: "No matching candidate found" };

        const assignedScheduleIds = matchedCandidate.assignedScheduleIds || [];
        if (assignedScheduleIds.length === 0) return { ok: false, error: "Candidate is not assigned to any schedule" };

        let selectedScheduleId = null;
        let selectedSchedule = null;
        let foundSchedule = false;

        for (const scheduleId of assignedScheduleIds) {
            try {
                const schedule = await getSchedule(scheduleId);
                if (!schedule) continue;
                foundSchedule = true;
                const isOpen = schedule.status === 'live' && schedule.paused !== true && schedule.endedAt == null;
                if (isOpen) {
                    selectedScheduleId = scheduleId;
                    selectedSchedule = schedule;
                    break;
                }
            } catch (err) {
                console.warn(`Failed to load schedule ${scheduleId}:`, err);
            }
        }

        if (!selectedScheduleId || !selectedSchedule) {
            if (foundSchedule) return { ok: false, error: "Session not open. Please wait for the proctor to start the session." };
            return { ok: false, error: "No valid schedule found for candidate" };
        }

        const rosterRef = doc(db, "schedules", selectedScheduleId, "roster", candidateId);
        const rosterSnap = await getDoc(rosterRef);

        if (!rosterSnap.exists()) return { ok: false, error: "Candidate not found in schedule roster" };

        const rosterData = rosterSnap.data();

        return {
            ok: true,
            scheduleId: selectedScheduleId,
            rosterCandidateId: rosterSnap.id,
            schedule: {
                title: selectedSchedule.title || "",
                examId: selectedSchedule.examId || null,
                examTitleSnapshot: selectedSchedule.examTitleSnapshot || "",
                examComponentsSnapshot: selectedSchedule.examComponentsSnapshot || []
            },
            candidate: {
                candidateId: candidateId,
                fullNameSnapshot: rosterData.fullNameSnapshot || matchedCandidate.fullName || "",
                dobSnapshot: rosterData.dobSnapshot || matchedCandidate.dob || "",
                classSnapshot: rosterData.classSnapshot || matchedCandidate.className || "",
                testerId: matchedCandidate.testerId || ""
            }
        };

    } catch (err) {
        console.error("findRosterEntryByNameAndTesterId error:", err);
        return { ok: false, error: "System error. Please contact proctor.", debug: err.message };
    }
}

export async function checkInRosterEntry(scheduleId, rosterCandidateId) {
    if (!scheduleId || !rosterCandidateId) return { ok: false, error: "Invalid parameters for check-in" };
    try {
        await setRosterStatus(scheduleId, rosterCandidateId, "checked_in");
        return { ok: true };
    } catch (err) {
        console.error("checkInRosterEntry error:", err);
        return { ok: false, error: "System error during check-in.", debug: err.message };
    }
}