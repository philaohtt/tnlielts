import { handleCredentialsSubmit, handleConfirmEnter, switchLoginMethod } from '../auth/candidate.auth.controller.js';
import { initCandidateTestPage, switchWritingTask, switchSkill, updateTestProgressBar } from './candidate.test.controller.js';

export function init() {
}

window.CANDIDATE_APP = {
    init,
    handleCredentialsSubmit,
    handleConfirmEnter,
    initCandidateTestPage,
    switchWritingTask,
    switchLoginMethod,
    switchSkill,
    updateTestProgressBar
};