// candidate.writing.view.js
// Renders the Writing section inside Candidate_Test.html

let autosaveTimeout = null;

function countWords(text) {
    if (!text || !text.trim()) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}

function setupWritingNavigation(totalTasks, currentTaskIdx, onSwitchTask) {
    let nav = document.getElementById('writingRightNav');
    if (!nav) {
        nav = document.createElement('div');
        nav.id = 'writingRightNav';
        nav.className = 'writing-nav-float';
        nav.innerHTML = `
            <button class="writing-nav-btn" id="writingPrevBtn" aria-label="Previous task">←</button>
            <button class="writing-nav-btn" id="writingNextBtn" aria-label="Next task">→</button>
        `;
        document.body.appendChild(nav);

        // Add CSS if not already added
        if (!document.getElementById('writingNavStyle')) {
            const style = document.createElement('style');
            style.id = 'writingNavStyle';
            style.textContent = `
                #writingRightNav { display: none; }
                body.mode-writing #writingRightNav { display: flex; }
                .writing-nav-float {
                    position: fixed;
                    right: 20px;
                    bottom: 120px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 30;
                }
                .writing-nav-btn {
                    width: 44px;
                    height: 44px;
                    border: none;
                    border-radius: 6px;
                    background: #111;
                    color: #fff;
                    font-size: 22px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                }
                .writing-nav-btn:disabled {
                    background: #ddd;
                    color: #fff;
                    cursor: not-allowed;
                    box-shadow: none;
                }
            `;
            document.head.appendChild(style);
        }
    }

    // Update button states
    const prevBtn = nav.querySelector('#writingPrevBtn');
    const nextBtn = nav.querySelector('#writingNextBtn');
    if (prevBtn) {
        prevBtn.disabled = currentTaskIdx <= 0;
        prevBtn.onclick = () => {
            if (currentTaskIdx > 0 && onSwitchTask) {
                onSwitchTask(currentTaskIdx - 1);
            }
        };
    }
    if (nextBtn) {
        nextBtn.disabled = currentTaskIdx >= totalTasks - 1;
        nextBtn.onclick = () => {
            if (currentTaskIdx < totalTasks - 1 && onSwitchTask) {
                onSwitchTask(currentTaskIdx + 1);
            }
        };
    }
}

function setupWritingDividerDrag() {
    const divider = document.getElementById('divider');
    const paneLeft = document.getElementById('paneLeft');
    const paneRight = document.getElementById('paneRight');
    const workspace = document.getElementById('workspace');
    if (!divider || !paneLeft || !paneRight || !workspace) return;

    if (divider.dataset.dragBound === '1') return;
    divider.dataset.dragBound = '1';

    const minWidth = 240;
    const maxMargin = 240;

    const onMouseMove = (e) => {
        const rect = workspace.getBoundingClientRect();
        const dividerWidth = divider.offsetWidth || 10;
        let newLeft = e.clientX - rect.left;
        const maxWidth = Math.max(minWidth, rect.width - maxMargin - dividerWidth);
        newLeft = Math.max(minWidth, Math.min(maxWidth, newLeft));

        paneLeft.style.width = `${newLeft}px`;
        paneLeft.style.flex = `0 0 ${newLeft}px`;
        paneRight.style.flex = '1 1 auto';
    };

    const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
    };

    divider.addEventListener('mousedown', (e) => {
        e.preventDefault();
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

export function renderWritingMode(ctx) {
    const {
        candidateName = '-',
        testerId = '-',
        examTitle = '-',
        writingTasks = [],
        activeTaskIndex = 0,
        getAnswer = () => '',
        setAnswer = () => {},
        onSwitchTask = () => {},
        onAutosave = () => {}
    } = ctx || {};

    // Switch page mode
    document.body.classList.remove('mode-listening', 'mode-reading');
    document.body.classList.add('mode-writing');

    // Update header/banner
    const hdrCandidateName = document.getElementById('hdr_candidateName');
    const hdrTesterId = document.getElementById('hdr_testerId');
    const hdrExamTitle = document.getElementById('hdr_examTitle');
    const bannerCandidateName = document.getElementById('bannerCandidateName');

    if (hdrCandidateName) hdrCandidateName.textContent = candidateName;
    if (hdrTesterId) hdrTesterId.textContent = testerId;
    if (hdrExamTitle) hdrExamTitle.textContent = examTitle;
    if (bannerCandidateName) bannerCandidateName.textContent = '';

    // Ensure valid task index
    const taskIdx = Math.max(0, Math.min(activeTaskIndex, writingTasks.length - 1));
    const activeTask = writingTasks[taskIdx] || {};

    // Update part banner with just the title
    const partBannerTitle = document.getElementById('partBannerTitle');
    if (partBannerTitle) {
        partBannerTitle.textContent = activeTask.title || '';
    }

    // Render task content in left pane (#passageContent)
    const passageContent = document.getElementById('passageContent');
    if (passageContent) {
        const instructions = activeTask.instructions || activeTask.instructionsText || '';
        const promptHtml = activeTask.promptHtml || '';
        const promptText = activeTask.prompt || '';
        const prompt = promptHtml || (promptText ? `<p>${promptText}</p>` : '');

        passageContent.innerHTML = (instructions ? `<div class="task-instructions">${instructions}</div>` : '') + 
                                    (prompt ? `<div class="task-prompt">${prompt}</div>` : '');
    }

    // Show editor, hide questions
    const editorContent = document.getElementById('editorContent');
    const questionsContent = document.getElementById('questionsContent');
    if (editorContent) editorContent.style.display = 'flex';
    if (questionsContent) questionsContent.style.display = 'none';

    // Load saved response into editor
    const answerTextarea = document.getElementById('answerTextarea');
    const wordCountLabel = document.getElementById('wordCountLabel');
    
    if (answerTextarea) {
        const answerKey = `writing:T${taskIdx + 1}`;
        const savedText = getAnswer(answerKey) || '';
        answerTextarea.value = savedText;

        // Update initial word count
        if (wordCountLabel) {
            const wordCount = countWords(savedText);
            wordCountLabel.textContent = `Words: ${wordCount}`;
        }

        // Bind autosave and word count on input
        answerTextarea.oninput = (e) => {
            const text = e.target.value || '';
            
            // Update word count
            if (wordCountLabel) {
                const wordCount = countWords(text);
                wordCountLabel.textContent = `Words: ${wordCount}`;
            }
            
            // Autosave
            if (autosaveTimeout) clearTimeout(autosaveTimeout);
            autosaveTimeout = setTimeout(() => {
                setAnswer(answerKey, text);
                if (onAutosave && typeof onAutosave === 'function') {
                    onAutosave(text);
                }
            }, 800);
        };
    }

    // Setup draggable divider
    setupWritingDividerDrag();

    // Setup navigation arrows
    setupWritingNavigation(writingTasks.length, taskIdx, onSwitchTask);

    // Footer: render task pills in partRow (matching Reading/Listening style)
    const partRow = document.getElementById('partRow');
    if (partRow) {
        partRow.innerHTML = '';
        writingTasks.forEach((task, idx) => {
            const pill = document.createElement('div');
            pill.className = `part-pill ${idx === taskIdx ? 'active' : ''}`;
            pill.innerHTML = `<span>Task ${idx + 1}</span>`;
            pill.onclick = () => {
                if (onSwitchTask && typeof onSwitchTask === 'function') {
                    onSwitchTask(idx);
                }
            };
            partRow.appendChild(pill);
        });
    }

    // Footer: clear question row (no questions for writing)
    const questionRow = document.getElementById('questionRow');
    if (questionRow) {
        questionRow.innerHTML = '';
    }
}