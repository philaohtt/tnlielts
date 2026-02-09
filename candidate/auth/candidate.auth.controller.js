// Purge candidate attempt keys from sessionStorage and localStorage
function purgeCandidateAttemptKeys() {
    const prefixes = [
        'canonical:',
        'candidate_progress_',
        'candidate_checks_',
        'candidate_answers:', // legacy
    ];
    const exactKeys = [
        'test_attempt_id',
        'answers_locked',
        'test_submitted',
        'pending_attempt_submission',
    ];
    // Remove keys starting with test_ and containing : (legacy)
    function isLegacyTestKey(key) {
        return key.startsWith('test_') && key.includes(':');
    }
    [sessionStorage, localStorage].forEach(store => {
        if (!store) return;
        const keysToRemove = [];
        for (let i = 0; i < store.length; i++) {
            const key = store.key(i);
            if (!key) continue;
            if (prefixes.some(p => key.startsWith(p)) || exactKeys.includes(key) || isLegacyTestKey(key)) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(key => {
            try { store.removeItem(key); } catch {}
        });
    });
}
import { findRosterEntryByCandidateId, findRosterEntryByNameAndTesterId, checkInRosterEntry } from "../data/candidate.roster.data.js";
import { showStep, setError, clearError, getUserFriendlyError } from "../app/candidate.utils.js";
import { renderConfirmation, switchLoginMethod as switchLoginUI } from "./candidate.auth.view.js";

let currentPayload = null;
let currentLoginMethod = 'candidateId';

export function switchLoginMethod(method) {
    currentLoginMethod = method;
    switchLoginUI(method);
}

export async function handleCredentialsSubmit() {
    clearError();
    const continueBtn = document.getElementById('continueBtn');
    let result;

    try {
        continueBtn.disabled = true;
        continueBtn.textContent = "Checking...";

        if (currentLoginMethod === 'candidateId') {
            const candidateIdInput = document.getElementById('candidateIdInput');
            const candidateId = candidateIdInput.value.trim();
            if (!candidateId) {
                setError("Please enter your Candidate ID.");
                return;
            }
            result = await findRosterEntryByCandidateId(candidateId);
        } else {
            const fullNameInput = document.getElementById('fullNameInput');
            const testerIdInput = document.getElementById('testerIdInput');
            const fullName = fullNameInput.value.trim();
            const testerId = testerIdInput.value.trim().toUpperCase();
            if (!fullName || !testerId) {
                setError("Please enter Full Name and Tester ID.");
                return;
            }
            result = await findRosterEntryByNameAndTesterId(fullName, testerId);
        }

        if (result && result.ok) {
            currentPayload = result;
            renderConfirmation(result);
            showStep('stepConfirm');
        } else {
            const technicalError = (result && result.error) ? result.error : "No match found. Please check your credentials.";
            const userFriendlyError = getUserFriendlyError(technicalError, 'AUTH_001');
            setError(userFriendlyError);
            window.location.href = `Candidate_Precheck.html?mode=error&reason=${encodeURIComponent(userFriendlyError)}`;
        }
    } catch (err) {
        console.error("Login Error:", err);
        const userFriendlyError = getUserFriendlyError(err.message || 'Connection error', 'AUTH_002');
        setError(userFriendlyError);
        window.location.href = `Candidate_Precheck.html?mode=error&reason=${encodeURIComponent(userFriendlyError)}`;
    } finally {
        continueBtn.disabled = false;
        continueBtn.textContent = "Continue";
    }
}

export async function handleConfirmEnter() {
    if (!currentPayload) return;
    const checkbox = document.getElementById('confirmCheckbox');
    if (!checkbox || !checkbox.checked) return;

    purgeCandidateAttemptKeys(); // Remove old candidate attempt keys
    clearError();
    showStep('stepEntering');

    try {
        const { scheduleId, rosterCandidateId, schedule, candidate } = currentPayload;
        try {
            await checkInRosterEntry(scheduleId, rosterCandidateId);
        } catch (checkInErr) {
            console.warn("Check-in failed, but proceeding to session storage:", checkInErr);
        }

        sessionStorage.setItem('candidate_schedule_id', scheduleId);
        sessionStorage.setItem('candidate_roster_id', rosterCandidateId);
        sessionStorage.setItem('candidate_tester_id', candidate.testerId);
        sessionStorage.setItem('candidate_exam_id', schedule.examId || '');
        sessionStorage.setItem('candidate_full_name', candidate.fullNameSnapshot || candidate.fullName || '');
        
        const componentsStr = JSON.stringify(schedule.examComponentsSnapshot || []);
        sessionStorage.setItem('candidate_exam_components', componentsStr);

        setTimeout(() => {
            window.location.href = `Candidate_Precheck.html?mode=check`;
        }, 800);

    } catch (err) {
        console.error("Entry Error:", err);
        const userFriendlyError = getUserFriendlyError(err.message || 'Failed to enter test', 'AUTH_003');
        setError(userFriendlyError);
        window.location.href = `Candidate_Precheck.html?mode=error&reason=${encodeURIComponent(userFriendlyError)}`;
        showStep('stepConfirm');
    }
}