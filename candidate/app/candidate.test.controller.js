import { loadCandidateTest } from "../data/candidate.test.data.js";
import { resolveComponentFromUrlOrSession, getOrderedComponents } from "../data/candidate.examplan.data.js";
import { renderListeningTestUI, stopListeningAudio } from "../views/candidate.skill.listening.js";
// import { renderWritingTestUI } from "./candidate.skill.writing.js";
import { renderReadingMode } from "../views/candidate.reading.view.js";
import { blockRenderers } from "../../core/index.js";
import { saveAnswer, getAnswer, buildSkillsPayload, applySkillsPayloadToSession, ensureAttemptId, hydrateAnswersFromLocal } from "../answers/candidate.answers.store.js";
import { createAttempt } from "../../db/db.attempts.js";
import { getAttemptById } from "../../db/db.attempts.js";
import { markCandidateSubmitted } from "../../db/db.proctor.js";
import { initTimer, startTimer, stopTimer, hideTimer } from "./candidate.timer.js";
import { serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

export let testPageState = {
    testId: null,
    skill: null,
    testDoc: null,
    candidateName: '-',
    candidateId: '-',
    currentTaskIndex: 0,
    answers: {},
    saveTimeout: null,
    sectionIndex: 0,
    writingTasks: [],
    activeWritingTaskIndex: 0
};

/**
 * Update the test progress bar based on completed skills and current skill
 */
export function updateTestProgressBar() {
    try {
        const candidateId = sessionStorage.getItem('candidate_tester_id') || sessionStorage.getItem('candidate_roster_id') || 'default';
        const progressKey = `candidate_progress_${candidateId}`;
        
        let progress = { completedSkills: [] };
        const rawProgress = sessionStorage.getItem(progressKey);
        if (rawProgress) {
            progress = JSON.parse(rawProgress);
        }
        if (!progress.completedSkills) progress.completedSkills = [];
        
        const currentSkill = testPageState.skill;
        const completedSkills = progress.completedSkills;
        
        // Update all skill elements
        const skillElements = document.querySelectorAll('.progress-skill');
        skillElements.forEach(element => {
            const skill = element.getAttribute('data-skill');
            
            // Remove all state classes
            element.classList.remove('upcoming', 'active', 'completed');
            
            // Determine state
            if (completedSkills.includes(skill)) {
                element.classList.add('completed');
                // Change icon to checkmark for completed
                const icon = element.querySelector('.progress-skill-icon');
                if (icon) icon.textContent = '✓';
            } else if (skill === currentSkill) {
                element.classList.add('active');
            } else {
                element.classList.add('upcoming');
            }
        });
    } catch (err) {
        console.error('[updateTestProgressBar] Failed to update progress bar:', err);
    }
}

export function showTestError(msg) {
    const container = document.getElementById('mainPanel') || document.body;
    container.innerHTML = `
        <div style="padding: 40px; text-align: center; background: #fef2f2; border-radius: 8px; color: #dc2626;">
            <h2>Test Error</h2>
            <p>${msg}</p>
            <button onclick="window.location.href='Candidate_Entry.html'" style="padding: 8px 16px; background: #dc2626; color: white; border: none; border-radius: 4px; cursor: pointer; margin-top: 16px;">
                Return to Login
            </button>
        </div>
    `;
}

async function getTimeLimitForCurrentSkill() {
    try {
        const components = await getOrderedComponents();
        const currentSkill = testPageState.skill;
        if (!currentSkill) return null;
        
        const component = components.find(c => c.skill === currentSkill);
        if (!component) return null;
        
        // Check component-level override first
        if (component.rules && component.rules.timeLimitMin) {
            return component.rules.timeLimitMin;
        }
        
        // Fall back to test document time limit
        if (testPageState.testDoc && testPageState.testDoc.totalTimeMin) {
            return testPageState.testDoc.totalTimeMin;
        }
        
        // Default time limits if not specified
        const skillLower = String(currentSkill).toLowerCase();
        const defaults = {
            'reading': 60,    // IELTS Reading: 60 minutes
            'writing': 60,    // IELTS Writing: 60 minutes
            'listening': 40,  // IELTS Listening: 40 minutes (approximately)
            'speaking': 15    // IELTS Speaking: 11-14 minutes
        };
        
        return defaults[skillLower] || null;
    } catch (err) {
        console.error('Error getting time limit:', err);
        return null;
    }
}

export function switchWritingTask(taskIndex) {
    const textarea = document.getElementById('answerTextarea');
    if (textarea) {
        const answerKey = `writing:T${testPageState.currentTaskIndex + 1}`;
        testPageState.answers[testPageState.currentTaskIndex] = textarea.value;
        saveAnswerToStorage(testPageState.testId, answerKey, textarea.value);
    }
    testPageState.currentTaskIndex = taskIndex;
    testPageState.activeWritingTaskIndex = taskIndex;
    sessionStorage.setItem('activeWritingTaskIndex', String(taskIndex));
    renderWritingScreen();
}

let renderWritingTestUI = null;

function getReadingSections(testData) {
    let sections = testData?.data || testData?.sections || [];
    if (!Array.isArray(sections)) sections = [];
    
    // Filter sections by skill field if present
    const hasSkillField = sections.some(s => s && (s.skill || s.skillSnapshot));
    
    if (hasSkillField) {
        const filtered = sections.filter(s => {
            const skill = String(s.skill || s.skillSnapshot || '').toLowerCase();
            return skill === 'reading';
        });
        if (filtered.length > 0) return filtered;
    }
    
    return sections;
}

function getWritingTasks(testData) {
    // Writing tasks might be stored in various locations
    let tasks = testData?.writing?.tasks || testData?.writingTasks || testData?.tasks || [];
    if (!Array.isArray(tasks)) tasks = [];
    if (tasks.length > 0) return tasks;
    
    // Fallback: Check if the test itself is a Writing test
    // If so, all sections in data are writing tasks
    const testSkill = String(testData?.skill || '').toLowerCase();
    if (testSkill === 'writing') {
        let sections = testData?.data || [];
        if (Array.isArray(sections) && sections.length > 0) {
            return sections;
        }
    }
    
    // If not a pure writing test, try to filter sections by skill='writing'
    let sections = testData?.sections || testData?.data || [];
    if (!Array.isArray(sections)) sections = [];
    const hasSkillField = sections.some(s => s && (s.skill || s.skillSnapshot));
    if (hasSkillField) {
        const filtered = sections.filter(s => String(s.skill || s.skillSnapshot || '').toLowerCase() === 'writing');
        if (filtered.length > 0) return filtered;
    }
    return tasks;
}

// Global answer context for event handlers
export let answerContextGlobal = null;

// Helper function to count answered questions in a section by checking storage
export function countAnsweredQuestionsInSection(section, testId, skill = 'reading') {
    if (!section || !testId) return 0;
    
    const blocks = section.questions || section.blocks || [];
    if (!Array.isArray(blocks)) return 0;
    
    let answeredCount = 0;
    
    blocks.forEach(block => {
        const type = (block?.type || '').toLowerCase();
        const blockId = block.id;
        const data = block?.data || {};
        
        if (type === 'gap_fill') {
            // Count filled gaps - each gap is stored with its own gapId
            const passageHtml = data.passageHtml || '';
            const temp = document.createElement('div');
            temp.innerHTML = passageHtml;
            const markers = temp.querySelectorAll('.gap-marker');
            let seq = 0;
            markers.forEach(marker => {
                const gapId = marker.dataset.id || `gap_${seq++}`;
                const answer = getAnswer({ skill, testId, type: 'gap', id: gapId });
                if (answer && answer.trim()) answeredCount++;
            });
        } else if (type === 'gap_fill_visual') {
            // Count filled gaps - each gap stored separately
            const gaps = Array.isArray(data.gaps) ? data.gaps : [];
            gaps.forEach(gap => {
                const gapId = gap.id;
                if (gapId) {
                    const answer = getAnswer({ skill, testId, type: 'gap', id: gapId });
                    if (answer && answer.trim()) answeredCount++;
                }
            });
        } else if (type === 'matching' || type === 'matching_headings') {
            // Check matching answers stored as object
            const matches = getAnswer({ skill, testId, type: 'matching', id: blockId });
            if (matches && typeof matches === 'object') {
                answeredCount += Object.keys(matches).filter(key => matches[key]).length;
            }
        } else if (type === 'matching_visual') {
            // Check matching visual answers
            const matches = getAnswer({ skill, testId, type: 'matching', id: blockId });
            if (matches && typeof matches === 'object') {
                answeredCount += Object.keys(matches).filter(key => matches[key]).length;
            }
        } else if (type === 'mcq_set') {
            // Count answered MCQ questions based on correctAnswerCount
            const questions = Array.isArray(data.questions) ? data.questions : [];
            questions.forEach(q => {
                const questionId = q.id;
                const answer = getAnswer({ skill, testId, type: 'mcq', id: `${blockId}:${questionId}` });
                const isAnswered = (answer !== null && answer !== undefined) && 
                                  ((Array.isArray(answer) && answer.length > 0) || 
                                   (!Array.isArray(answer) && answer !== ''));
                
                if (isAnswered) {
                    // Count based on correctAnswerCount (for multi-answer questions like "choose TWO")
                    const count = q.correctAnswerCount || (q.allowMultiple ? 2 : 1);
                    answeredCount += count;
                }
            });
        } else if (type === 'tfng') {
            // Count answered TFNG questions
            const questions = Array.isArray(data.questions) ? data.questions : [];
            questions.forEach(q => {
                const questionId = q.id;
                const answer = getAnswer({ skill, testId, type: 'tfng', id: `${blockId}:${questionId}` });
                if (answer !== null && answer !== undefined && answer !== '') answeredCount++;
            });
        }
    });
    
    return answeredCount;
}

function renderBlocksInto(container, section) {
    if (!container || !section) return;
    let blocks = section.questions || section.blocks || [];
    if (!Array.isArray(blocks)) blocks = [];

    const ctx = {
        getAnswer: (blockId) => {
            if (blockId && blockId.includes('matching')) {
                return getAnswer({ skill: 'reading', testId: testPageState.testId, type: 'matching', id: blockId });
            }
            return getAnswer({ skill: 'reading', testId: testPageState.testId, type: 'gap', id: blockId });
        },
        setAnswer: (blockId, value) => {
            if (blockId && blockId.includes('matching')) {
                saveAnswer({ skill: 'reading', testId: testPageState.testId, type: 'matching', id: blockId, value });
            } else {
                saveAnswer({ skill: 'reading', testId: testPageState.testId, type: 'gap', id: blockId, value });
            }
        },
        getMcqAnswer: (blockId, questionId) => getAnswer({ skill: 'reading', testId: testPageState.testId, type: 'mcq', id: `${blockId}:${questionId}` }),
        setMcqAnswer: (blockId, questionId, value) => saveAnswer({ skill: 'reading', testId: testPageState.testId, type: 'mcq', id: `${blockId}:${questionId}`, value }),
        getTfngAnswer: (blockId, questionId) => getAnswer({ skill: 'reading', testId: testPageState.testId, type: 'tfng', id: `${blockId}:${questionId}` }),
        setTfngAnswer: (blockId, questionId, value) => saveAnswer({ skill: 'reading', testId: testPageState.testId, type: 'tfng', id: `${blockId}:${questionId}`, value }),
        getPassageHtml: () => {
            return section?.instructions || '';
        }
    };
    
    // Store globally for use in event handlers
    answerContextGlobal = ctx;

    const renderedBlocks = blocks.map((block, index) => {
        const blockType = (block?.type || '').toLowerCase().trim();
        const renderer = blockRenderers[blockType];
        let blockHtml = '';
        if (renderer && typeof renderer === 'function') {
            try {
                blockHtml = renderer(block, ctx);
            } catch (err) {
                console.error(`Error rendering ${blockType} block:`, err);
                blockHtml = `
                    <div style="padding: 16px; background: #fef2f2; border-radius: 8px; color: #dc2626;">
                        <div style="font-weight: 600; margin-bottom: 8px;">Rendering Error</div>
                        <div style="font-size: 12px;">${String(err.message || err)}</div>
                    </div>
                `;
            }
        } else {
            blockHtml = `
                <div style="padding: 16px; background: #f9f9f9; border-radius: 8px; color: #666;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Block Type: ${blockType || 'unknown'}</div>
                </div>
            `;
        }
        const anchorId = `question-${testPageState.sectionIndex}-${index}`;
        const separator = index < blocks.length - 1 ? '<div class="block-separator"></div>' : '';
        return `<div id="${anchorId}" class="question-anchor">${blockHtml}</div>${separator}`;
    }).join('');

    container.innerHTML = renderedBlocks;
    
    // Apply global numbering across blocks (matching Listening flow)
    const testDoc = testPageState.testDoc;
    let allSections = testDoc?.data || testDoc?.sections || [];
    if (!Array.isArray(allSections)) allSections = [];
    
    // Get reading sections only
    let readingSections = allSections.filter(s => {
        const skill = String(s.skill || s.skillSnapshot || '').toLowerCase();
        return skill === 'reading' || !skill;
    });
    
    // Calculate offset from previous sections
    const offset = readingSections.slice(0, testPageState.sectionIndex)
        .reduce((sum, sec) => {
            const qBlocks = sec.questions || sec.blocks || [];
            return sum + (Array.isArray(qBlocks) ? qBlocks.length : 0);
        }, 0);
    
    let counter = offset;
    
    // Get all rendered question elements
    const blockEls = Array.from(container.querySelectorAll(
        '.gap-block, .gap-visual-block, .matching-block, .matching-canvas-task, .mcq-block'
    ));
    
    // Apply numbering to each block type
    blocks.forEach((block, idx) => {
        const blockEl = blockEls[idx];
        if (!blockEl) return;
        
        const type = (block?.type || '').toLowerCase();
        
        if (type === 'gap_fill') {
            const nums = blockEl.querySelectorAll('.gap-num');
            const inputs = blockEl.querySelectorAll('.gap-input');
            const wraps = blockEl.querySelectorAll('.gap-input-wrap');
            nums.forEach((numEl, i) => {
                const num = ++counter;
                numEl.textContent = String(num);
                if (inputs[i]) inputs[i].dataset.qnum = String(num);
                const val = inputs[i]?.value || '';
                numEl.style.display = val ? 'none' : '';
                const wrap = wraps[i] || inputs[i]?.closest('.gap-input-wrap');
                if (wrap) {
                    wrap.dataset.qnum = String(num);
                    wrap.dataset.qtype = 'gap_fill';
                    wrap.classList.add('question-anchor');
                }
            });
            return;
        }
        
        if (type === 'gap_fill_visual') {
            const nums = blockEl.querySelectorAll('.gap-number');
            const inputs = blockEl.querySelectorAll('.map-input');
            const boxes = blockEl.querySelectorAll('.map-gap-box');
            inputs.forEach((inputEl, i) => {
                const num = ++counter;
                inputEl.dataset.qnum = String(num);
                const numEl = nums[i];
                if (numEl) {
                    numEl.textContent = String(num);
                    numEl.style.display = inputEl.value ? 'none' : '';
                }
                const box = boxes[i] || inputEl.closest('.map-gap-box');
                if (box) {
                    box.dataset.qnum = String(num);
                    box.dataset.qtype = 'gap_fill_visual';
                    box.classList.add('question-anchor');
                }
            });
            return;
        }
        
        if (type === 'matching') {
            const items = blockEl.querySelectorAll('.matching-item');
            const nums = blockEl.querySelectorAll('.matching-item-num');
            items.forEach((itemEl, i) => {
                const num = ++counter;
                const numEl = nums[i];
                if (numEl) numEl.textContent = String(num);
                itemEl.dataset.qnum = String(num);
                itemEl.dataset.qtype = 'matching';
                itemEl.classList.add('question-anchor');
            });
            return;
        }
        
        if (type === 'matching_visual') {
            const gaps = blockEl.querySelectorAll('.mc-zone--gap');
            const nums = blockEl.querySelectorAll('.mc-zone-num');
            gaps.forEach((gapEl, i) => {
                const num = ++counter;
                const numEl = nums[i];
                if (numEl) numEl.textContent = String(num);
                gapEl.dataset.qnum = String(num);
                gapEl.dataset.qtype = 'matching_visual';
                gapEl.classList.add('question-anchor');
            });
            return;
        }
        
        if (type === 'mcq_set') {
            const questions = blockEl.querySelectorAll('.mcq-question');
            questions.forEach((qEl, i) => {
                const num = ++counter;
                const numEl = qEl.querySelector('.mcq-question-num');
                if (numEl) numEl.textContent = String(num);
                qEl.dataset.qnum = String(num);
                qEl.dataset.qtype = 'mcq_set';
                qEl.classList.add('question-anchor');
            });
            return;
        }
    });
}

function renderReadingScreen() {
    const testDoc = testPageState.testDoc;
    if (!testDoc) {
        showTestError("Test document not loaded.");
        return;
    }

    let sections = getReadingSections(testDoc);
    if (!Array.isArray(sections)) sections = [];

    if (sections.length === 0) {
        showTestError("No Reading sections found in this test.");
        return;
    }

    if (typeof testPageState.sectionIndex !== 'number') testPageState.sectionIndex = 0;
    
    // Ensure sectionIndex is within bounds
    if (testPageState.sectionIndex >= sections.length) {
        testPageState.sectionIndex = 0;
    }

    const currentSection = sections[testPageState.sectionIndex];
    if (!currentSection) {
        showTestError("Section not found.");
        return;
    }

    renderReadingMode({
        candidateName: testPageState.candidateName || '-',
        testerId: testPageState.candidateId || '-',
        examTitle: testPageState.testDoc?.name || '-',
        sections: sections,
        sectionIndex: testPageState.sectionIndex,
        currentSection: currentSection,
        onSwitchPassage: (i) => {
            testPageState.sectionIndex = i;
            renderReadingScreen();
        },
        renderBlocksInto
    });
}

function renderWritingScreen() {
    const testDoc = testPageState.testDoc;
    if (!testDoc) {
        showTestError("Test document not loaded.");
        return;
    }

    let writingTasks = getWritingTasks(testDoc);
    if (!Array.isArray(writingTasks)) writingTasks = [];

    if (writingTasks.length === 0) {
        showTestError("No Writing tasks found in this test.");
        return;
    }

    // Ensure taskIndex is within bounds
    if (typeof testPageState.activeWritingTaskIndex !== 'number') testPageState.activeWritingTaskIndex = 0;
    if (testPageState.activeWritingTaskIndex >= writingTasks.length) {
        testPageState.activeWritingTaskIndex = 0;
    }

    if (!renderWritingTestUI) {
        showTestError("Writing module not loaded.");
        return;
    }

    renderWritingTestUI({
        candidateName: testPageState.candidateName || '-',
        testerId: testPageState.candidateId || '-',
        examTitle: testPageState.testDoc?.name || '-',
        writingTasks: writingTasks,
        activeTaskIndex: testPageState.activeWritingTaskIndex,
        getAnswer: (answerKey) => {
            return getAnswer({ skill: 'writing', testId: testPageState.testId, type: 'writing', id: answerKey });
        },
        setAnswer: (answerKey, value) => {
            saveAnswer({ skill: 'writing', testId: testPageState.testId, type: 'writing', id: answerKey, value });
        },
        onSwitchTask: (i) => {
            testPageState.activeWritingTaskIndex = i;
            testPageState.currentTaskIndex = i;
            sessionStorage.setItem('activeWritingTaskIndex', String(i));
            renderWritingScreen();
        },
        onAutosave: (text) => {
            // Optional: perform additional actions on autosave
        }
    });
}

export async function switchSkill(skillName) {
    const normalized = String(skillName || '').trim() || 'Listening';
    
    // Clean up audio when switching away from Listening
    if (testPageState.skill === 'Listening' && normalized !== 'Listening') {
        stopListeningAudio();
    }
    
    testPageState.skill = normalized;
    sessionStorage.setItem('currentSkill', normalized);

    // Load the test for the new skill
    const component = resolveComponentFromUrlOrSession();
    
    if (component && component.testId) {
        try {
            const testData = await loadCandidateTest(component.testId);
            testPageState.testId = testData.id;
            testPageState.testDoc = testData;
        } catch (err) {
            console.error("Failed to load test for skill:", normalized, err);
            showTestError(`Failed to load ${normalized} test: ${err.message}`);
            return;
        }
    } else {
        console.error('[switchSkill] No component found for skill:', normalized);
        showTestError(`No test found for ${normalized}`);
        return;
    }

    // Reset section index when switching skills
    testPageState.sectionIndex = 0;

    const bodyEl = document.body;
    if (bodyEl) {
        bodyEl.classList.remove('mode-reading', 'mode-listening', 'mode-writing');
        const modeClass = `mode-${normalized.toLowerCase()}`;
        bodyEl.classList.add(modeClass);
    }
    
    // Start timer for the new skill (but not for Listening, which uses audio duration)
    if (normalized === 'Listening') {
        hideTimer();
    } else {
        const timeLimit = await getTimeLimitForCurrentSkill();
        if (timeLimit && timeLimit > 0) {
            startTimer(timeLimit);
        } else {
            hideTimer();
        }
    }

    if (normalized === 'Writing') {
        if (!renderWritingTestUI) {
            const mod = await import("../views/candidate.writing.view.js");
            renderWritingTestUI = mod.renderWritingMode;
        }
        const storedWritingIdx = parseInt(sessionStorage.getItem('activeWritingTaskIndex') || '0', 10);
        testPageState.activeWritingTaskIndex = Number.isFinite(storedWritingIdx) ? storedWritingIdx : 0;
        testPageState.currentTaskIndex = testPageState.activeWritingTaskIndex;
        renderWritingScreen();
    } else if (normalized === 'Reading') {
        renderReadingScreen();
    } else {
        renderListeningTestUI();
    }
    
    // Update progress bar to reflect current skill state
    updateTestProgressBar();
}

export async function initCandidateTestPage() {
    try {
        hydrateAnswersFromLocal();
        if (!sessionStorage.getItem('test_submitted')) {
            try {
                await retryPendingSubmission();
            } catch (e) {
                console.warn('[initCandidateTestPage] Pending submission retry failed:', e);
            }
        }

        const component = resolveComponentFromUrlOrSession();
        if (!component || !component.testId) {
            showTestError("Unable to determine test. Please return to login.");
            return;
        }

        if (component.view === 'login') {
            window.location.href = 'Candidate_Entry.html';
            return;
        }

        const testData = await loadCandidateTest(component.testId);
        testPageState.testId = testData.id;
        testPageState.testDoc = testData;

        // Get candidate info from sessionStorage
        const rawCandidateName = sessionStorage.getItem('candidate_full_name') || '';
        const candidateName = rawCandidateName || '-';
        const candidateId = sessionStorage.getItem('candidate_tester_id') || '-';
        
        // Update header with test info
        const headerCandidateName = document.getElementById('hdr_candidateName');
        const headerTesterId = document.getElementById('hdr_testerId');
        const headerExamTitle = document.getElementById('hdr_examTitle');
        
        if (headerCandidateName) {
            headerCandidateName.textContent = candidateName;
        }
        if (headerTesterId) {
            headerTesterId.textContent = `Test taker ID: ${candidateId}`;
        }
        if (headerExamTitle) {
            headerExamTitle.textContent = `Exam: ${testData.name || '-'}`;
        }

        // Store for later use
        testPageState.candidateName = candidateName;
        testPageState.candidateId = candidateId;

        // Prepare writing tasks
        testPageState.writingTasks = getWritingTasks(testData);

        const storedWritingIdx = parseInt(sessionStorage.getItem('activeWritingTaskIndex') || '0', 10);
        testPageState.activeWritingTaskIndex = Number.isFinite(storedWritingIdx) ? storedWritingIdx : 0;

        const urlParams = new URLSearchParams(window.location.search);
        const skillParam = urlParams.get('skill');
        const storedSkill = sessionStorage.getItem('currentSkill') || sessionStorage.getItem('candidate_test_skill');
        let skill = skillParam || storedSkill || 'Listening';
        
        // Initialize timer
        initTimer();

        // Resume in-progress attempt if available
        try {
            const draftAttemptId = ensureAttemptId();
            if (draftAttemptId) {
                const existingAttempt = await getAttemptById(draftAttemptId);
                if (existingAttempt && existingAttempt.status !== 'submitted' && existingAttempt.skills) {
                    applySkillsPayloadToSession(existingAttempt.skills);
                }
            }
        } catch (e) {
            console.warn('[initCandidateTestPage] Failed to load draft attempt:', e);
        }
        
        // Start timer for initial skill (but not for Listening, which uses audio duration)
        testPageState.skill = skill;
        if (skill !== 'Listening') {
            const timeLimit = await getTimeLimitForCurrentSkill();
            if (timeLimit && timeLimit > 0) {
                startTimer(timeLimit);
            }
        } else {
            hideTimer();
        }

        // Skill transition handlers
        const btnSubmit = document.getElementById('btnSubmit');
        if (btnSubmit) {
            btnSubmit.onclick = async () => {
                // Stop timer when submitting
                stopTimer();
                
                // Mark current skill as completed - use candidate-specific key
                try {
                    const candidateId = sessionStorage.getItem('candidate_tester_id') || sessionStorage.getItem('candidate_roster_id') || 'default';
                    const progressKey = `candidate_progress_${candidateId}`;
                    
                    let progress = { completedSkills: [] };
                    const rawProgress = sessionStorage.getItem(progressKey);
                    if (rawProgress) {
                        progress = JSON.parse(rawProgress);
                    }
                    if (!progress.completedSkills) progress.completedSkills = [];
                    
                    const currentSkill = testPageState.skill;
                    if (currentSkill && !progress.completedSkills.includes(currentSkill)) {
                        progress.completedSkills.push(currentSkill);
                        sessionStorage.setItem(progressKey, JSON.stringify(progress));
                        
                        // Update progress bar to show completion
                        updateTestProgressBar();
                    }
                } catch (err) {
                    console.error('[btnSubmit] Failed to update progress:', err);
                }
                
                if (testPageState.skill === 'Listening') {
                    if (confirm('Listening test finished. Return to pre-test check?')) {
                        window.location.href = 'Candidate_Precheck.html';
                    }
                    return;
                }
                if (testPageState.skill === 'Reading') {
                    if (confirm('Reading test finished. Return to pre-test check?')) {
                        window.location.href = 'Candidate_Precheck.html';
                    }
                    return;
                }
                if (testPageState.skill === 'Writing') {
                    if (confirm('Writing test finished. Return to pre-test check?')) {
                        window.location.href = 'Candidate_Precheck.html';
                    }
                    return;
                }
            };
        }

        await switchSkill(skill);
        
        // Initialize progress bar on page load
        updateTestProgressBar();

    } catch (err) {
        console.error("initCandidateTestPage error:", err);
        showTestError(err.message || "Failed to initialize test page");
    }
}

/**
 * Submit final test - collects all answers from storage and submits to backend
 */
export async function submitTest() {
    try {
        // Get candidate info from session
        const candidateId = sessionStorage.getItem('candidate_roster_id') || sessionStorage.getItem('candidate_tester_id');
        const scheduleId = sessionStorage.getItem('candidate_schedule_id');
        const examId = sessionStorage.getItem('candidate_exam_id');
        
        if (!candidateId || !scheduleId || !examId) {
            throw new Error('Missing required session data for submission');
        }
        
        const currentSkill = String(testPageState.skill || '').toLowerCase();
        const testDoc = testPageState.testDoc;
        const blocksSnapshotBySkill = {};
        if (testDoc && currentSkill) {
            const sections = testDoc.data || testDoc.sections || [];
            const blocks = sections.flatMap(s => s.questions || s.blocks || []);
            if (blocks.length > 0) {
                blocksSnapshotBySkill[currentSkill] = blocks;
            }
        }

        const skills = buildSkillsPayload({
            skill: currentSkill,
            currentSkill,
            blocksSnapshotBySkill
        });
        
        // Prepare submission payload
        let attemptId = sessionStorage.getItem('test_attempt_id') || ensureAttemptId() || undefined;
        const submittedAtClient = new Date().toISOString();
        const submission = {
            attemptId,
            candidateId,
            scheduleId,
            examId,
            status: "submitted",
            submittedAt: serverTimestamp(),
            skills,
            candidateName: sessionStorage.getItem('candidate_full_name') || '',
            testerId: sessionStorage.getItem('candidate_tester_id') || ''
        };
        
        console.log('[submitTest] Submitting test with payload:', submission);
        
        // Save pending submission to localStorage for retry-safe fallback
        localStorage.setItem('pending_attempt_submission', JSON.stringify(submission));
        
        // Submit to backend
        const attempt = await createAttempt(submission);
        attemptId = attempt.id || attempt.attemptId;
        
        // Remove pending submission on success
        localStorage.removeItem('pending_attempt_submission');
        
        // Store attempt ID in session
        if (attemptId) {
            sessionStorage.setItem('test_attempt_id', attemptId);
        }
        
        // Mark test as submitted in session
        sessionStorage.setItem('test_submitted', 'true');
        sessionStorage.setItem('test_submitted_at', submittedAtClient);

        // Update roster status (best-effort)
        try {
            if (submission.scheduleId && submission.candidateId) {
                await markCandidateSubmitted(submission.scheduleId, submission.candidateId);
            }
        } catch (e) {
            console.warn('[retryPendingSubmission] Failed to update candidate status:', e);
        }

        // Update roster status (best-effort)
        try {
            if (scheduleId && candidateId) {
                await markCandidateSubmitted(scheduleId, candidateId);
            }
        } catch (e) {
            console.warn('[submitTest] Failed to update candidate status:', e);
        }
        
        // Fallback: store in localStorage for retry
        try {
            const submissionKey = `test_submission_${candidateId}_${examId}_${Date.now()}`;
            localStorage.setItem(submissionKey, JSON.stringify({ ...submission, submittedAt: submittedAtClient }));
        } catch (e) {
            console.warn('[submitTest] Failed to store fallback:', e);
        }
        
        console.log('[submitTest] Test submitted successfully, attempt ID:', attemptId);
        
        return {
            success: true,
            attemptId,
            submittedAt: submittedAtClient
        };
        
    } catch (error) {
        console.error('[submitTest] Error submitting test:', error);
        // Leave pending_attempt_submission intact for retry
        throw error;
    }
}

/**
 * Retry pending submission - attempts to submit previously failed submission
 */
export async function retryPendingSubmission() {
    try {
        const pendingData = localStorage.getItem('pending_attempt_submission');
        
        if (!pendingData) {
            return { success: false, reason: 'no_pending' };
        }
        
        const submission = JSON.parse(pendingData);
        console.log('[retryPendingSubmission] Retrying submission:', submission);
        
        // Attempt to submit
        const attempt = await createAttempt(submission);
        const attemptId = attempt.id || attempt.attemptId;
        
        // Remove pending submission on success
        localStorage.removeItem('pending_attempt_submission');
        
        // Set sessionStorage flags
        if (attemptId) {
            sessionStorage.setItem('test_attempt_id', attemptId);
        }
        sessionStorage.setItem('test_submitted', 'true');
        sessionStorage.setItem('test_submitted_at', submission.submittedAt);
        
        console.log('[retryPendingSubmission] Retry successful, attempt ID:', attemptId);
        
        return {
            success: true,
            attemptId,
            submittedAt: submission.submittedAt
        };
        
    } catch (error) {
        console.error('[retryPendingSubmission] Retry failed:', error);
        throw error;
    }
}