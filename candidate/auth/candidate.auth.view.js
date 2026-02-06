import { clearError } from "../app/candidate.utils.js";

export function renderConfirmation(payload) {
    const { candidate = {}, schedule = {} } = payload || {};

    const candidateIdEl = document.getElementById('disp_candidateId');
    if (candidateIdEl) candidateIdEl.textContent = candidate.candidateId || 'N/A';

    const fullNameEl = document.getElementById('disp_fullName');
    if (fullNameEl) fullNameEl.textContent = candidate.fullNameSnapshot || candidate.fullName || 'N/A';

    const testerIdEl = document.getElementById('disp_testerId');
    if (testerIdEl) testerIdEl.textContent = candidate.testerId || 'N/A';

    const classNameEl = document.getElementById('disp_className');
    if (classNameEl) classNameEl.textContent = candidate.classSnapshot || 'N/A';

    const dobEl = document.getElementById('disp_dob');
    if (dobEl) dobEl.textContent = candidate.dobSnapshot || 'N/A';

    const examTitleEl = document.getElementById('disp_examTitle');
    if (examTitleEl) examTitleEl.textContent = schedule.examTitleSnapshot || 'N/A';
}

export function switchLoginMethod(method) {
    const tabCandidateId = document.getElementById('tabCandidateId');
    const tabNameTesterId = document.getElementById('tabNameTesterId');
    const methodCandidateId = document.getElementById('methodCandidateId');
    const methodNameTesterId = document.getElementById('methodNameTesterId');
    
    if (method === 'candidateId') {
        tabCandidateId?.classList.add('active');
        tabNameTesterId?.classList.remove('active');
        methodCandidateId?.classList.remove('hidden');
        methodNameTesterId?.classList.add('hidden');
    } else {
        tabCandidateId?.classList.remove('active');
        tabNameTesterId?.classList.add('active');
        methodCandidateId?.classList.add('hidden');
        methodNameTesterId?.classList.remove('hidden');
    }
    clearError();
}