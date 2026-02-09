import { testPageState, answerContextGlobal, countAnsweredQuestionsInSection } from "../app/candidate.test.controller.js";

export function renderReadingMode(ctx) {
    // Set active mode class
    document.body.classList.remove('mode-listening', 'mode-writing');
    document.body.classList.add('mode-reading');

    // Update header/banner
    const hdrCandidateName = document.getElementById('hdr_candidateName');
    const hdrTesterId = document.getElementById('hdr_testerId');
    const hdrExamTitle = document.getElementById('hdr_examTitle');
    const bannerCandidateName = document.getElementById('bannerCandidateName');

    if (hdrCandidateName) hdrCandidateName.textContent = ctx.candidateName;
    if (hdrTesterId) hdrTesterId.textContent = ctx.testerId;
    if (hdrExamTitle) hdrExamTitle.textContent = ctx.examTitle;
    if (bannerCandidateName) bannerCandidateName.textContent = ctx.candidateName;

    const currentSection = ctx.currentSection;
    const sections = ctx.sections || [];
    const sectionIndex = ctx.sectionIndex || 0;

    // Update part banner
    const partBannerTitle = document.getElementById('partBannerTitle');
    if (partBannerTitle) {
        partBannerTitle.textContent = `Passage ${sectionIndex + 1}${
            currentSection.title ? ': ' + currentSection.title : ''
        }`;
    }

    // Render passage content
    const passageContent = document.getElementById('passageContent');
    if (passageContent) {
        let html = currentSection.passageHtml || currentSection.instructions || '';
        
        // Process for matching_headings blocks - inject drop zones into passage
        const questions = currentSection.questions || currentSection.blocks || [];
        const mhBlock = questions.find(q => (q.type || '').toLowerCase() === 'matching_headings');
        
        if (mhBlock && mhBlock.data) {
            const slots = mhBlock.data.slots || [];
            const options = mhBlock.data.options || [];
            const blockId = mhBlock.id || 'matching_headings_' + Math.random().toString(36).substr(2, 9);
            // Parse passage HTML to find paragraphs
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = html;
            const children = Array.from(tempDiv.children);
            // Get saved answers for this block to show in drop zones
            const savedMatches = answerContextGlobal && typeof answerContextGlobal.getAnswer === 'function' ? (answerContextGlobal.getAnswer(blockId) || {}) : {};
            // For each slot, inject a drop zone at the appropriate paragraph
            // Sort by paraIndex in reverse order to avoid index shifting
            const sortedSlots = [...slots].sort((a, b) => (b.paraIndex || 0) - (a.paraIndex || 0));
            // Create a mapping of slotId to question number (robust: check slotId or id)
            const slotToNumber = {};
            let questionNum = 1;
            [...slots].sort((a, b) => (a.paraIndex || 0) - (b.paraIndex || 0)).forEach(s => {
                const id = s.slotId || s.id;
                slotToNumber[id] = questionNum++;
            });
            sortedSlots.forEach((slot) => {
                const paraIndex = slot.paraIndex;
                const slotId = slot.slotId || slot.id;
                const questionNumber = slotToNumber[slotId];
                if (paraIndex >= 0 && paraIndex < children.length) {
                    const para = children[paraIndex];
                    if (para) {
                        // Check if this slot has a saved answer
                        const matchedLetter = savedMatches[slotId];
                        const matchedOption = matchedLetter 
                            ? options.find((opt, optIdx) => String.fromCharCode(65 + optIdx) === matchedLetter)
                            : null;
                        // Create the drop zone HTML as a span element
                        const dropZoneSpan = document.createElement('span');
                        dropZoneSpan.className = 'mh-passage-drop-zone';
                        dropZoneSpan.setAttribute('data-slot-id', slotId);
                        dropZoneSpan.setAttribute('data-question-number', questionNumber);
                        dropZoneSpan.draggable = true;
                        if (matchedOption) {
                            dropZoneSpan.style.cssText = 'display: inline-block; min-width: 140px; min-height: 22px; border: 2px solid #0284c7; background: #e0f2fe; border-radius: 4px; padding: 2px 6px; margin: 0 4px 0 0; vertical-align: baseline; line-height: 1.2; transition: 0.2s; cursor: pointer; font-size: 13px;';
                            dropZoneSpan.innerHTML = `<span style="color: #0284c7; font-weight: 700; margin-right: 4px;">${matchedLetter}</span><span style="color: #0c4a6e;">${matchedOption.text || ''}</span>`;
                        } else {
                            dropZoneSpan.style.cssText = 'display: inline-block; min-width: 140px; min-height: 22px; border: 2px dashed #cbd5e1; background: #fbfcfd; border-radius: 4px; padding: 2px 6px; margin: 0 4px 0 0; vertical-align: baseline; line-height: 1.2; transition: 0.2s; cursor: pointer; font-size: 13px;';
                            dropZoneSpan.innerHTML = `<span class="mh-drop-zone-number" style="color: #0284c7; font-weight: 700; margin-right: 6px; font-size: 14px;">${questionNumber}</span><span style="color: #94a3b8; font-style: italic;">___</span>`;
                        }
                        if (para.firstChild) {
                            para.insertBefore(dropZoneSpan, para.firstChild);
                        } else {
                            para.appendChild(dropZoneSpan);
                        }
                    }
                }
            });
            html = tempDiv.innerHTML;
        }
        
        passageContent.innerHTML = html;
    }

    // Render question blocks
    const questionsContent = document.getElementById('questionsContent');
    if (questionsContent && ctx.renderBlocksInto) {
        // Apply block styling (matching Listening)
        if (!document.getElementById('reading-block-style')) {
            const style = document.createElement('style');
            style.id = 'reading-block-style';
            style.textContent = `
                .gap-numbering { font-weight: 700; color: #64748b; margin-bottom: 6px; }
                .gap-instructions { color: #64748b; margin-bottom: 12px; font-size: 13px; }
                .gap-passage { line-height: 1.9; font-size: 16px; color: #1a202c; }
                .gap-input-wrap { display: inline-flex; align-items: center; justify-content: center; position: relative; margin: 0 2px; }
                .gap-num { position: absolute; font-size: 14px; color: #999; font-weight: bold; pointer-events: none; z-index: 1; transition: opacity 0.2s; }
                .gap-input { width: 90px; padding: 4px 6px; border: 1px solid #cbd5e1; border-radius: 4px; font-size: 14px; font-family: inherit; text-align: center; }
                .gap-input:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.1); }
                .mcq-block { margin: 0; }
                .matching-block { margin: 0; }
                .matching-option { cursor: move; transition: opacity 0.2s; }
                .matching-option:hover { box-shadow: 0 2px 8px rgba(37, 99, 235, 0.2); }
                .matching-selected-area { transition: all 0.2s; }
                .matching-match-badge { cursor: pointer; transition: background 0.2s; }
                .matching-match-badge:hover { background: #1e40af !important; }
                .block-separator { margin: 32px 0; border-top: 2px solid #e2e8f0; }
                
                .gap-visual-block { font-family: Arial, sans-serif; color: #333; margin-top: 20px; }
                .cbt-instruction-box { background-color: #f3f9ff; border: 1px solid #c2e0ff; padding: 15px; margin-bottom: 20px; border-radius: 4px; line-height: 1.5; }
                .map-numbering-text { font-weight: bold; display: block; margin-bottom: 4px; font-size: 15px; }
                .map-instruction-content { font-size: 15px; font-style: italic; color: #444; }
                .map-stage { max-width: 980px; margin: 0; padding: 0 5px 0 0; }
                .map-container { position: relative; display: inline-block; width: auto; max-width: 100%; border: 1px solid #ddd; box-sizing: border-box; max-height: 70vh; overflow: hidden; }
                .map-img { display: block; user-select: none; max-width: 100%; width: auto; height: auto; max-height: 70vh; object-fit: contain; }
                .map-overlay { position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; }
                .text-layer, .gap-layer { position: absolute; top: 0; left: 0; width: 100%; height: 100%; }
                .map-text-label { position: absolute; pointer-events: none; white-space: normal; word-wrap: break-word; overflow: visible; box-sizing: border-box; display: flex; flex-direction: column; justify-content: center; line-height: 1.2; }
                .map-gap-box { position: absolute; pointer-events: auto; box-sizing: border-box; display: flex; align-items: center; justify-content: center; }
                .gap-number { position: absolute; font-weight: bold; color: #999; pointer-events: none; z-index: 1; transition: opacity 0.2s; }
                .map-input { width: 100%; height: 100%; border: 1px solid #333; background: #fff; text-align: center; font-size: 100%; box-sizing: border-box; font-weight: 500; padding: 2px; outline: none; }
                .map-input::placeholder { color: #666; }

                .matching-canvas-task { font-family: Arial, sans-serif; color: #333; margin-top: 20px; }
                .mc-layout { display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 18px; margin-top: 16px; align-items: start; }
                .mc-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; box-shadow: 0 1px 2px rgba(0,0,0,0.04); }
                .mc-img-container { position: relative; display: inline-block; max-width: 100%; }
                .mc-img { display: block; max-width: 100%; height: auto; }
                .mc-overlay { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
                .mc-zone { position: absolute; box-sizing: border-box; }
                .mc-zone--gap { pointer-events: auto; border: 1px dashed #cbd5e1; border-radius: 6px; display: flex; align-items: center; justify-content: center; background: rgba(255,255,255,0.35); }
                .mc-zone--gap.has-answer { background: rgba(255,255,255,0.15); }
                .mc-zone--gap.is-over { border-color: #0ea5e9; background: rgba(219,234,254,0.4) !important; }
                .mc-zone-num { font-weight: 700; color: #64748b; font-size: 14px; }
                .mc-placed-pill { display: flex; align-items: center; gap: 8px; background: rgba(224,242,254,0.7); border: 1px solid #0ea5e9; border-radius: 999px; padding: 4px 10px; font-size: 12px; cursor: grab; }
                .mc-placed-pill span { white-space: nowrap; }
                .mc-clr { border: none; background: transparent; font-weight: 700; cursor: pointer; }
                .mc-bank-title { font-weight: 700; color: #1a202c; margin-bottom: 8px; }
                .mc-bank { display: flex; flex-direction: column; gap: 8px; }
                .mc-pill { padding: 8px 10px; border: 1.5px solid #2563eb; border-radius: 8px; background: #f0f9ff; cursor: grab; user-select: none; }
                .mc-pill.used { border-color: #cbd5e1; background: #f3f4f6; color: #999; cursor: default; }
                .question-anchor.question-active { outline: 2px solid #2b6cb0; outline-offset: 2px; border-radius: 4px; }

                /* Right-side question navigation (Reading only) */
                #readingRightNav { display: none; }
                body.mode-reading #readingRightNav { display: flex; }
                .reading-nav-float {
                    position: fixed;
                    right: 20px;
                    bottom: 220px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 30;
                }
                .reading-nav-btn {
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
                    transition: all 0.3s ease;
                }
                .reading-nav-btn:hover:not(:disabled) {
                    background: #333;
                    transform: scale(1.1);
                }
                .reading-nav-btn:disabled {
                    background: #ddd;
                    color: #fff;
                    cursor: not-allowed;
                    box-shadow: none;
                }
                
                /* Section transition indicator */
                #readingSectionTransition { display: none; }
                body.mode-reading #readingSectionTransition { display: flex; }
                .reading-section-transition {
                    position: fixed;
                    right: 10px;
                    bottom: 170px;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 8px;
                    z-index: 29;
                    pointer-events: none;
                }
                .section-complete-badge {
                    background: rgba(16, 185, 129, 0.95);
                    color: white;
                    padding: 6px 10px;
                    border-radius: 6px;
                    font-size: 12px;
                    font-weight: 600;
                    text-align: center;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.2);
                    animation: slideInRight 0.4s ease;
                    white-space: nowrap;
                    pointer-events: none;
                }
                .section-next-btn {
                    width: 48px;
                    height: 48px;
                    border: none;
                    border-radius: 6px;
                    background: #2563eb;
                    color: #fff;
                    font-size: 24px;
                    font-weight: 700;
                    cursor: pointer;
                    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.4);
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    pointer-events: auto;
                }
                .section-next-btn:hover {
                    background: #1d4ed8;
                    transform: scale(1.15);
                    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.6);
                }
                @keyframes slideInRight {
                    from {
                        opacity: 0;
                        transform: translateX(30px);
                    }
                    to {
                        opacity: 1;
                        transform: translateX(0);
                    }
                }
                
                .tfng-block { margin: 0; font-family: Arial, sans-serif; }
                .tfng-list { display: flex; flex-direction: column; gap: 16px; margin-top: 12px; }
                .tfng-row { display: flex; flex-direction: column; gap: 12px; padding: 12px 0; border-bottom: 1px solid #e2e8f0; }
                .tfng-row:last-child { border-bottom: none; }
                .tfng-statement { font-size: 16px; color: #1a202c; line-height: 1.6; }
                .tfng-q-num { font-weight: 700; color: #1a202c; margin-right: 8px; }
                .tfng-options-group { display: flex; gap: 16px; align-items: center; padding-left: 28px; }
                .tfng-option-label { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
                .tfng-option-input { cursor: pointer; width: 16px; height: 16px; }
                .tfng-option-text { font-weight: 600; font-size: 14px; color: #334155; }
                .tfng-option-label:hover .tfng-option-text { color: #2563eb; }
            `;
            document.head.appendChild(style);
        }
        
        ctx.renderBlocksInto(questionsContent, currentSection);
        
        // Apply global numbering (matching Listening flow)
        applyReadingGlobalNumbering(questionsContent, testPageState.testDoc, sectionIndex);
        
        // Setup event handlers for all block types (matching Listening behavior)
        setupReadingBlockEventHandlers(questionsContent, ctx);
    }

    // Build part/passage navigation
    renderPartRow(ctx);

    // Build question navigation
    renderQuestionRow(ctx);

    // Enable draggable divider for reading split panes
    setupReadingDividerDrag();
}

function setupReadingDividerDrag() {
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

function renderPartRow(ctx) {
    const partRow = document.getElementById('partRow');
    if (!partRow) return;

    const sections = ctx.sections || [];
    const sectionIndex = ctx.sectionIndex || 0;
    const testDoc = testPageState.testDoc;

    // Helper to count questions in a section
    const countSectionQuestions = (section) => {
        const blocks = section?.questions || section?.blocks || [];
        if (!Array.isArray(blocks)) return 0;
        return blocks.reduce((sum, block) => {
            const type = (block?.type || '').toLowerCase();
            const data = block?.data || {};
            if (type === 'gap_fill') {
                const temp = document.createElement('div');
                temp.innerHTML = data.passageHtml || '';
                return sum + temp.querySelectorAll('.gap-marker').length;
            }
            if (type === 'gap_fill_visual') return sum + (Array.isArray(data.gaps) ? data.gaps.length : 0);
            if (type === 'matching') return sum + (Array.isArray(data.items) ? data.items.length : 0);
            if (type === 'matching_headings') return sum + (Array.isArray(data.slots) ? data.slots.length : 0);
            if (type === 'matching_visual') return sum + (Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0);
            if (type === 'mcq_set') {
                const questions = Array.isArray(data.questions) ? data.questions : [];
                return sum + questions.reduce((qSum, q) => {
                    let correctAnswerCount = q.correctAnswerCount;
                    if (!correctAnswerCount) {
                        if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                            correctAnswerCount = q.correctIndices.length;
                        } else {
                            correctAnswerCount = (q.allowMultiple ? 2 : 1);
                        }
                    }
                    return qSum + correctAnswerCount;
                }, 0);
            }
            if (type === 'tfng') return sum + (Array.isArray(data.questions) ? data.questions.length : 0);
            return sum;
        }, 0);
    };

    // Count answered questions per section
    let running = 0;
    partRow.innerHTML = sections.map((sec, idx) => {
        const count = countSectionQuestions(sec);
        const start = running + 1;
        const end = running + count;
        
        // Count answered questions by checking storage instead of DOM
        const answered = countAnsweredQuestionsInSection(sec, testPageState.testId, 'reading');
        
        running = end;
        return `<div class="part-pill ${idx === sectionIndex ? 'active' : ''}" data-part-idx="${idx}">
            <span>Passage ${idx + 1}</span>
            <span class="part-count">${answered} of ${count}</span>
        </div>`;
    }).join('');

    // Add click handlers
    partRow.onclick = (e) => {
        const pill = e.target.closest('.part-pill');
        if (pill) {
            const idx = parseInt(pill.dataset.partIdx, 10);
            if (!Number.isNaN(idx) && ctx.onSwitchPassage) {
                ctx.onSwitchPassage(idx);
            }
        }
    };
}

function renderQuestionRow(ctx) {
    const questionRow = document.getElementById('questionRow');
    if (!questionRow) return;

    const currentSection = ctx.currentSection;
    const sectionIndex = ctx.sectionIndex || 0;
    const sections = ctx.sections || [];

    // Helper to count questions across all sections before current
    const getOffsetQuestions = (sectionIdx) => {
        let offset = 0;
        for (let i = 0; i < sectionIdx; i++) {
            const blocks = sections[i]?.questions || sections[i]?.blocks || [];
            offset += Array.from(blocks).reduce((sum, block) => {
                const type = (block?.type || '').toLowerCase();
                const data = block?.data || {};
                if (type === 'gap_fill') {
                    const temp = document.createElement('div');
                    temp.innerHTML = data.passageHtml || '';
                    return sum + temp.querySelectorAll('.gap-marker').length;
                }
                if (type === 'gap_fill_visual') return sum + (Array.isArray(data.gaps) ? data.gaps.length : 0);
                if (type === 'matching') return sum + (Array.isArray(data.items) ? data.items.length : 0);
                if (type === 'matching_headings') return sum + (Array.isArray(data.slots) ? data.slots.length : 0);
                if (type === 'matching_visual') return sum + (Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0);
                if (type === 'mcq_set') {
                    const questions = Array.isArray(data.questions) ? data.questions : [];
                    return sum + questions.reduce((qSum, q) => {
                        let correctAnswerCount = q.correctAnswerCount;
                        if (!correctAnswerCount) {
                            if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                                correctAnswerCount = q.correctIndices.length;
                            } else {
                                correctAnswerCount = (q.allowMultiple ? 2 : 1);
                            }
                        }
                        return qSum + correctAnswerCount;
                    }, 0);
                }
                if (type === 'tfng') return sum + (Array.isArray(data.questions) ? data.questions.length : 0);
                return sum;
            }, 0);
        }
        return offset;
    };

    // Count total questions in current section and build MCQ mapping
    const blocks = Array.isArray(currentSection.questions) && currentSection.questions.length
        ? currentSection.questions
        : (Array.isArray(currentSection.blocks) ? currentSection.blocks : []);
    
    const offsetQuestions = getOffsetQuestions(sectionIndex);
    
    let totalQuestions = 0;
    const mcqNumberRanges = {}; // Map MCQ block/question index to number range
    let currentNum = offsetQuestions + 1; // Start from the global offset, not 1
    
    blocks.forEach((block, blockIdx) => {
        const type = (block?.type || '').toLowerCase();
        const data = block?.data || {};
        
        let blockQuestionCount = 0;
        
        if (type === 'gap_fill') {
            const temp = document.createElement('div');
            temp.innerHTML = data.passageHtml || '';
            blockQuestionCount = temp.querySelectorAll('.gap-marker').length;
        } else if (type === 'gap_fill_visual') {
            blockQuestionCount = Array.isArray(data.gaps) ? data.gaps.length : 0;
        } else if (type === 'matching') {
            blockQuestionCount = Array.isArray(data.items) ? data.items.length : 0;
        } else if (type === 'matching_headings') {
            blockQuestionCount = Array.isArray(data.slots) ? data.slots.length : 0;
        } else if (type === 'matching_visual') {
            blockQuestionCount = Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0;
        } else if (type === 'mcq_set') {
            const questions = Array.isArray(data.questions) ? data.questions : [];
            questions.forEach((q, qIdx) => {
                // IMPROVED LOGIC
                let correctAnswerCount = q.correctAnswerCount;
                if (!correctAnswerCount) {
                    if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                        correctAnswerCount = q.correctIndices.length;
                    } else {
                        correctAnswerCount = (q.allowMultiple ? 2 : 1);
                    }
                }
                const startNum = currentNum;
                currentNum += correctAnswerCount;
                const key = `${blockIdx}-${qIdx}`;
                if (correctAnswerCount > 1) {
                    mcqNumberRanges[key] = `${startNum}-${currentNum - 1}`;
                } else {
                    mcqNumberRanges[key] = String(startNum);
                }
                blockQuestionCount += correctAnswerCount;
            });
        } else if (type === 'tfng') {
            blockQuestionCount = Array.isArray(data.questions) ? data.questions.length : 0;
        }
        
        // For non-MCQ blocks, advance currentNum by the block question count
        if (type !== 'mcq_set') {
            currentNum += blockQuestionCount;
        }
        
        totalQuestions += blockQuestionCount;
    });

    const startQuestionNum = offsetQuestions + 1;
    const endQuestionNum = offsetQuestions + totalQuestions;
    const activeQuestionNum = testPageState.activeQuestionNumber || startQuestionNum;

    // Helper function to check if a question has an answer
    const hasAnswer = (globalQuestionNum) => {
        const questionEl = document.querySelector(`[data-qnum="${globalQuestionNum}"]`);
        if (!questionEl) return false;
        
        const qtype = questionEl.dataset.qtype;
        if (!qtype) return false;
        
        if (qtype === 'gap_fill' || qtype === 'gap_fill_visual') {
            const input = questionEl.querySelector('input');
            return input && input.value.trim().length > 0;
        } else if (qtype === 'mcq_set') {
            const checked = questionEl.querySelector('input.mcq-option-input:checked');
            return !!checked;
        } else if (qtype === 'tfng') {
            const checked = questionEl.querySelector('input.tfng-option-input:checked');
            return !!checked;
        } else if (qtype === 'matching' || qtype === 'matching_visual') {
            const placed = questionEl.querySelector('.mc-placed-pill');
            return !!placed;
        } else if (qtype === 'matching_headings') {
            // Check if the drop zone has a matched heading
            const numSpan = questionEl.querySelector('.mh-drop-zone-number');
            return !numSpan || numSpan.textContent === '';
        }
        return false;
    };

    // Build HTML for question row
    let html = '';
    let currentGlobalNum = offsetQuestions + 1;
    
    for (let blockIdx = 0; blockIdx < blocks.length; blockIdx++) {
        const block = blocks[blockIdx];
        const type = (block?.type || '').toLowerCase();
        const data = block?.data || {};
        
        if (type === 'mcq_set') {
            const questions = Array.isArray(data.questions) ? data.questions : [];
            questions.forEach((q, qIdx) => {
                const key = `${blockIdx}-${qIdx}`;
                const numberDisplay = mcqNumberRanges[key] || '';
                const isActive = currentGlobalNum === activeQuestionNum;
                const hasAns = hasAnswer(currentGlobalNum);
                html += `<button class="question-num-btn ${isActive ? 'active' : ''} ${hasAns ? 'has-answer' : ''}" data-qnum="${currentGlobalNum}" title="Question ${numberDisplay}">${numberDisplay}</button>`;
                // IMPROVED LOGIC
                let correctAnswerCount = q.correctAnswerCount;
                if (!correctAnswerCount) {
                    if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                        correctAnswerCount = q.correctIndices.length;
                    } else {
                        correctAnswerCount = (q.allowMultiple ? 2 : 1);
                    }
                }
                currentGlobalNum += correctAnswerCount;
            });
        } else {
            // Count questions in non-MCQ block
            let blockQuestionCount = 0;
            if (type === 'gap_fill') {
                const temp = document.createElement('div');
                temp.innerHTML = data.passageHtml || '';
                blockQuestionCount = temp.querySelectorAll('.gap-marker').length;
            } else if (type === 'gap_fill_visual') {
                blockQuestionCount = Array.isArray(data.gaps) ? data.gaps.length : 0;
            } else if (type === 'matching') {
                blockQuestionCount = Array.isArray(data.items) ? data.items.length : 0;
            } else if (type === 'matching_headings') {
                blockQuestionCount = Array.isArray(data.slots) ? data.slots.length : 0;
            } else if (type === 'matching_visual') {
                blockQuestionCount = Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0;
            } else if (type === 'tfng') {
                blockQuestionCount = Array.isArray(data.questions) ? data.questions.length : 0;
            }
            
            // Render individual question buttons
            for (let i = 0; i < blockQuestionCount; i++) {
                const isActive = currentGlobalNum === activeQuestionNum;
                const hasAns = hasAnswer(currentGlobalNum);
                
                html += `<button class="question-num-btn ${isActive ? 'active' : ''} ${hasAns ? 'has-answer' : ''}" data-qnum="${currentGlobalNum}">${currentGlobalNum}</button>`;
                currentGlobalNum++;
            }
        }
    }
    
    questionRow.innerHTML = html;

    // Add event listeners for question buttons
    questionRow.querySelectorAll('.question-num-btn').forEach(btn => {
        btn.onclick = () => {
            const qnum = parseInt(btn.dataset.qnum, 10);
            const anchor = document.querySelector(`[data-qnum="${qnum}"]`);
            if (anchor) {
                anchor.scrollIntoView({ behavior: 'smooth' });
                testPageState.activeQuestionNumber = qnum;
                renderQuestionRow(ctx);
            }
        };
    });

    updateReadingRightNav(startQuestionNum, endQuestionNum, ctx);
}

function updatePartRowCounts() {
    const partRow = document.getElementById('partRow');
    if (!partRow) return;
    
    const pills = partRow.querySelectorAll('.part-pill');
    pills.forEach((pill, idx) => {
        const testDoc = testPageState.testDoc;
        if (!testDoc) return;
        
        let sections = testDoc?.data || testDoc?.sections || [];
        if (!Array.isArray(sections)) sections = [];
        
        // Filter reading sections
        sections = sections.filter(s => {
            const skill = String(s.skill || s.skillSnapshot || '').toLowerCase();
            return skill === 'reading' || !skill;
        });
        
        const sec = sections[idx];
        if (!sec) return;
        
        const answered = countAnsweredQuestionsInSection(sec, testPageState.testId, 'reading');
        const countSpan = pill.querySelector('.part-count');
        if (countSpan) {
            const totalMatch = countSpan.textContent.match(/of (\d+)/);
            const total = totalMatch ? totalMatch[1] : '?';
            countSpan.textContent = `${answered} of ${total}`;
        }
    });
}

function updateReadingRightNav(startNum, endNum, ctx) {
    const start = Number.isFinite(startNum) ? startNum : 1;
    const end = Number.isFinite(endNum) ? endNum : start;
    const currentNum = testPageState.activeQuestionNumber || start;

    const allSections = Array.isArray(ctx?.sections) ? ctx.sections : [];
    const totalQuestionsAll = allSections.reduce((sum, sec) => {
        const blocks = sec?.questions || sec?.blocks || [];
        if (!Array.isArray(blocks)) return sum;
        const count = blocks.reduce((acc, block) => {
            const type = (block?.type || '').toLowerCase();
            const data = block?.data || {};
            if (type === 'gap_fill') {
                const temp = document.createElement('div');
                temp.innerHTML = data.passageHtml || '';
                return acc + temp.querySelectorAll('.gap-marker').length;
            }
            if (type === 'gap_fill_visual') return acc + (Array.isArray(data.gaps) ? data.gaps.length : 0);
            if (type === 'matching') return acc + (Array.isArray(data.items) ? data.items.length : 0);
            if (type === 'matching_headings') return acc + (Array.isArray(data.slots) ? data.slots.length : 0);
            if (type === 'matching_visual') return acc + (Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0);
            if (type === 'mcq_set') {
                const questions = Array.isArray(data.questions) ? data.questions : [];
                return acc + questions.reduce((qSum, q) => {
                    let count = q.correctAnswerCount;
                    if (!count) {
                        if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                            count = q.correctIndices.length;
                        } else {
                            count = q.allowMultiple ? 2 : 1;
                        }
                    }
                    return qSum + count;
                }, 0);
            }
            if (type === 'tfng') return acc + (Array.isArray(data.questions) ? data.questions.length : 0);
            return acc;
        }, 0);
        return sum + count;
    }, 0);

    let nav = document.getElementById('readingRightNav');
    if (!nav) {
        nav = document.createElement('div');
        nav.id = 'readingRightNav';
        nav.className = 'reading-nav-float';
        nav.innerHTML = `
            <button class="reading-nav-btn" id="readingPrevBtn" aria-label="Previous question">←</button>
            <button class="reading-nav-btn" id="readingNextBtn" aria-label="Next question">→</button>
        `;
        document.body.appendChild(nav);
    }

    // Create section transition indicator if it doesn't exist
    let sectionTransition = document.getElementById('readingSectionTransition');
    if (!sectionTransition) {
        sectionTransition = document.createElement('div');
        sectionTransition.id = 'readingSectionTransition';
        sectionTransition.className = 'reading-section-transition';
        document.body.appendChild(sectionTransition);
    }

    // Check if user is at the end of current section but not at the end of all questions
    const isAtSectionEnd = currentNum === end && end < totalQuestionsAll;
    const canMoveToNextSection = isAtSectionEnd && (ctx.sectionIndex || 0) < (ctx.sections?.length || 0) - 1;

    // Update section transition indicator
    sectionTransition.innerHTML = '';
    if (canMoveToNextSection) {
        sectionTransition.innerHTML = `
            <div class="section-complete-badge">✓ Section Complete</div>
            <button class="section-next-btn" id="readingSectionNextBtn" aria-label="Next section" title="Move to next section">→</button>
        `;
        const sectionNextBtn = sectionTransition.querySelector('#readingSectionNextBtn');
        if (sectionNextBtn) {
            sectionNextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const nextSectionIdx = Math.min((ctx.sections?.length || 1) - 1, (ctx.sectionIndex || 0) + 1);
                if (typeof ctx?.onSwitchPassage === 'function') {
                    ctx.onSwitchPassage(nextSectionIdx);
                }
            });
        }
    }

    // Remove old event listeners to prevent stale closures
    const prevBtn = nav.querySelector('#readingPrevBtn');
    const nextBtn = nav.querySelector('#readingNextBtn');
    
    if (prevBtn) {
        const newPrevBtn = prevBtn.cloneNode(true);
        prevBtn.parentNode.replaceChild(newPrevBtn, prevBtn);
        newPrevBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentNum = testPageState.activeQuestionNumber || start;
            if (currentNum > 1) {
                const nextNum = currentNum - 1;
                testPageState.activeQuestionNumber = nextNum;
                if (nextNum < start && typeof ctx?.onSwitchPassage === 'function') {
                    const prevSectionIdx = Math.max(0, (ctx.sectionIndex || 0) - 1);
                    ctx.onSwitchPassage(prevSectionIdx);
                    return;
                }
                const anchor = document.querySelector(`[data-qnum="${nextNum}"]`);
                if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                renderQuestionRow(ctx);
            }
        });
    }
    
    if (nextBtn) {
        const newNextBtn = nextBtn.cloneNode(true);
        nextBtn.parentNode.replaceChild(newNextBtn, nextBtn);
        newNextBtn.addEventListener('click', (e) => {
            e.preventDefault();
            const currentNum = testPageState.activeQuestionNumber || start;
            if (currentNum < totalQuestionsAll) {
                const nextNum = currentNum + 1;
                testPageState.activeQuestionNumber = nextNum;
                if (nextNum > end && typeof ctx?.onSwitchPassage === 'function') {
                    const nextSectionIdx = Math.min((ctx.sections?.length || 1) - 1, (ctx.sectionIndex || 0) + 1);
                    ctx.onSwitchPassage(nextSectionIdx);
                    return;
                }
                const anchor = document.querySelector(`[data-qnum="${nextNum}"]`);
                if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
                renderQuestionRow(ctx);
            }
        });
    }

    // Re-query buttons after replacement
    const updatedPrevBtn = nav.querySelector('#readingPrevBtn');
    const updatedNextBtn = nav.querySelector('#readingNextBtn');
    if (updatedPrevBtn) updatedPrevBtn.disabled = currentNum <= 1;
    if (updatedNextBtn) updatedNextBtn.disabled = currentNum >= totalQuestionsAll;
}

function updateQuestionButtonStatus(globalQuestionNum) {
    const btn = document.querySelector(`.question-num-btn[data-qnum="${globalQuestionNum}"]`);
    if (!btn) return;
    
    const questionEl = document.querySelector(`[data-qnum="${globalQuestionNum}"]`);
    if (!questionEl) return;
    
    const qtype = questionEl.dataset.qtype;
    if (!qtype) return;
    
    let hasAnswer = false;
    
    if (qtype === 'gap_fill' || qtype === 'gap_fill_visual') {
        const input = questionEl.querySelector('input');
        hasAnswer = input && input.value.trim().length > 0;
    } else if (qtype === 'mcq_set') {
        const checked = questionEl.querySelector('input.mcq-option-input:checked');
        hasAnswer = !!checked;
    } else if (qtype === 'tfng') {
        const checked = questionEl.querySelector('input.tfng-option-input:checked');
        hasAnswer = !!checked;
    } else if (qtype === 'matching' || qtype === 'matching_visual') {
        const placed = questionEl.querySelector('.mc-placed-pill');
        hasAnswer = !!placed;
    } else if (qtype === 'matching_headings') {
        // Check if the drop zone has a matched heading
        const numSpan = questionEl.querySelector('.mh-drop-zone-number');
        hasAnswer = !numSpan || numSpan.textContent === '';
    }
    
    if (hasAnswer) {
        btn.classList.add('has-answer');
    } else {
        btn.classList.remove('has-answer');
    }
}

function setupReadingBlockEventHandlers(questionsContent, ctx) {
    // Get the global answer context that was set by renderBlocksInto
    const answerCtx = answerContextGlobal || ctx;
    
    if (!answerCtx) {
        console.warn('No answer context available for event handlers');
        return;
    }
    questionsContent.querySelectorAll('.gap-input').forEach(input => {
        const gapId = input.dataset.gapId;
        if (!gapId) return;
        
        // Track active question on focus
        input.addEventListener('focus', (e) => {
            const wrap = e.target.closest('.gap-input-wrap');
            if (wrap) {
                const qnum = parseInt(wrap.dataset.qnum, 10);
                if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                    testPageState.activeQuestionNumber = qnum;
                    renderQuestionRow(ctx);
                }
            }
        });
        
        input.addEventListener('input', (e) => {
            answerCtx.setAnswer(gapId, e.target.value);
            const wrap = e.target.closest('.gap-input-wrap');
            if (wrap) {
                const numSpan = wrap.querySelector('.gap-num');
                if (numSpan) {
                    numSpan.style.display = e.target.value ? 'none' : '';
                }
                const qnum = parseInt(wrap.dataset.qnum, 10);
                if (!Number.isNaN(qnum)) {
                    updateQuestionButtonStatus(qnum);
                }
            }
            updatePartRowCounts();
        });
    });

    // Handle map-input fields for visual gap fills
    questionsContent.querySelectorAll('.map-input').forEach(input => {
        const gapId = input.dataset.gapId;
        if (!gapId) return;
        
        // Track active question on focus
        input.addEventListener('focus', (e) => {
            const box = e.target.closest('.map-gap-box');
            if (box) {
                const qnum = parseInt(box.dataset.qnum, 10);
                if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                    testPageState.activeQuestionNumber = qnum;
                    renderQuestionRow(ctx);
                }
            }
        });
        
        input.addEventListener('input', (e) => {
            answerCtx.setAnswer(gapId, e.target.value);
            const box = e.target.closest('.map-gap-box');
            if (box) {
                const numSpan = box.querySelector('.gap-number');
                if (numSpan) {
                    numSpan.style.display = e.target.value ? 'none' : '';
                }
                const qnum = parseInt(box.dataset.qnum, 10);
                if (!Number.isNaN(qnum)) {
                    updateQuestionButtonStatus(qnum);
                }
            }
            updatePartRowCounts();
        });
    });

    // Handle MCQ option inputs
    questionsContent.querySelectorAll('.mcq-option-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const blockId = e.target.dataset.blockId;
            const qid = e.target.dataset.qid;
            const optIdx = parseInt(e.target.dataset.optIdx, 10);
            if (!blockId || !qid || Number.isNaN(optIdx)) return;

            // Track active question
            let titleEl = e.target.closest('[data-qnum][data-qtype="mcq_set"]');
            if (titleEl) {
                const qnum = parseInt(titleEl.dataset.qnum, 10);
                if (!Number.isNaN(qnum)) {
                    if (testPageState.activeQuestionNumber !== qnum) {
                        testPageState.activeQuestionNumber = qnum;
                        renderQuestionRow(ctx);
                    }
                    updateQuestionButtonStatus(qnum);
                }
            }

            if (e.target.type === 'radio') {
                answerCtx.setMcqAnswer(blockId, qid, optIdx);
            } else {
                const group = questionsContent.querySelectorAll(`.mcq-option-input[type="checkbox"][data-block-id="${blockId}"][data-qid="${qid}"]`);
                const selected = Array.from(group).filter(i => i.checked).map(i => parseInt(i.dataset.optIdx, 10)).filter(n => !Number.isNaN(n));
                answerCtx.setMcqAnswer(blockId, qid, selected);
            }
            
            updatePartRowCounts();
        });
    });

    // Handle matching block drag-and-drop
    questionsContent.querySelectorAll('.matching-block').forEach(block => {
        const blockId = block.dataset.blockId;
        if (!blockId) return;

        const options = block.querySelectorAll('.matching-option');
        const targets = block.querySelectorAll('.matching-target');

        options.forEach(option => {
            option.draggable = true;
            option.addEventListener('dragstart', (e) => {
                e.dataTransfer.effectAllowed = 'move';
                // FIX: Use optionLetter
                e.dataTransfer.setData('text/plain', option.dataset.optionLetter);
            });
        });

        targets.forEach(target => {
            target.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                target.style.background = '#f0f0f0';
            });
            target.addEventListener('dragleave', () => {
                target.style.background = '';
            });
            target.addEventListener('drop', (e) => {
                e.preventDefault();
                // FIX: Retrieve letter
                const optionLetter = e.dataTransfer.getData('text/plain');
                const itemNum = target.dataset.itemNum; // Use item number as key
                if (optionLetter && itemNum) {
                    // FIX: Read-Modify-Write pattern
                    const currentMatches = answerCtx.getAnswer(blockId) || {};
                    currentMatches[itemNum] = optionLetter;
                    answerCtx.setAnswer(blockId, currentMatches);
                    const qnum = parseInt(target.dataset.qnum, 10);
                    if (!Number.isNaN(qnum)) {
                        updateQuestionButtonStatus(qnum);
                    }
                    updatePartRowCounts();
                }
                target.style.background = '';
            });
        });
    });

    // Handle matching-visual (canvas-based) blocks
    questionsContent.querySelectorAll('.matching-canvas-task').forEach(block => {
        const blockId = block.dataset.blockId;
        if (!blockId) return;


                const pills = block.querySelectorAll('.mc-pill');
                const zones = block.querySelectorAll('.mc-zone--gap');

                // --- Matching-visual drag/drop helpers (Listening-style) ---
                const allowReuse = block.dataset.allowReuse === 'true';
                let didDrop = false;
                let lastDragSourceZoneId = null;

                const updateBankUsage = (matches) => {
                    if (allowReuse) return;
                    const used = new Set(Object.values(matches || {}));
                    block.querySelectorAll('.mc-pill').forEach(p => {
                        const isUsed = used.has(p.dataset.optionLetter);
                        p.classList.toggle('used', isUsed);
                        p.setAttribute('draggable', isUsed ? 'false' : 'true');
                        p.style.opacity = isUsed ? '0.4' : '1';
                        p.style.cursor = isUsed ? 'default' : 'grab';
                    });
                };

                const renderZoneEmpty = (zoneEl) => {
                    const zoneNum = zoneEl.dataset.zoneNum || '';
                    zoneEl.classList.remove('has-answer');
                    zoneEl.innerHTML = `<div class="mc-zone-num">${zoneNum}</div>`;
                };

                const renderZoneFilled = (zoneEl, optionLetter) => {
                    const bankPill = block.querySelector(`.mc-pill[data-option-letter="${optionLetter}"]`);
                    const optionText = (bankPill?.textContent || optionLetter).trim();
                    zoneEl.classList.add('has-answer');
                    zoneEl.innerHTML = `\n    <div class="mc-placed-pill" data-option-letter="${optionLetter}" draggable="true">\n      <span>${optionText}</span>\n      <button class="mc-clr" data-zone-id="${zoneEl.dataset.zoneId}">×</button>\n    </div>\n  `;
                };

                pills.forEach(pill => {
                    pill.draggable = true;
                    pill.addEventListener('dragstart', (e) => {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', pill.dataset.optionLetter);
                    });
                });
                // --- Drag-out from placed pill ---
                block.addEventListener('dragstart', (e) => {
                    const placed = e.target.closest('.mc-placed-pill');
                    if (!placed) return;
                    const zone = placed.closest('.mc-zone--gap');
                    didDrop = false;
                    lastDragSourceZoneId = zone?.dataset.zoneId || null;
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', placed.dataset.optionLetter || '');
                    if (zone?.dataset.zoneId) e.dataTransfer.setData('text/source-zone', zone.dataset.zoneId);
                });

                block.addEventListener('dragend', (e) => {
                    // If user dragged the placed pill out and did not drop into another zone → remove answer
                    if (didDrop || !lastDragSourceZoneId) return;
                    const matches = answerCtx.getAnswer(blockId) || {};
                    const sourceZoneEl = block.querySelector(`.mc-zone--gap[data-zone-id="${lastDragSourceZoneId}"]`);
                    const sourceZoneNum = sourceZoneEl?.dataset.zoneNum;
                    if (sourceZoneNum) {
                        delete matches[sourceZoneNum];
                        answerCtx.setAnswer(blockId, matches);
                        if (sourceZoneEl) renderZoneEmpty(sourceZoneEl);
                        updateBankUsage(matches);
                        const qnum = parseInt(sourceZoneEl?.dataset.qnum || '', 10);
                        if (!Number.isNaN(qnum)) updateQuestionButtonStatus(qnum);
                        updatePartRowCounts();
                    }
                    lastDragSourceZoneId = null;
                });

                // --- Click-to-remove (×) handler ---
                block.addEventListener('click', (e) => {
                    const btn = e.target.closest('.mc-clr');
                    if (!btn) return;
                    const zoneId = btn.dataset.zoneId;
                    const zoneEl = block.querySelector(`.mc-zone--gap[data-zone-id="${zoneId}"]`);
                    const zoneNum = zoneEl?.dataset.zoneNum;
                    if (!zoneNum) return;
                    const matches = answerCtx.getAnswer(blockId) || {};
                    delete matches[zoneNum];
                    answerCtx.setAnswer(blockId, matches);
                    if (zoneEl) renderZoneEmpty(zoneEl);
                    updateBankUsage(matches);
                    const qnum = parseInt(zoneEl?.dataset.qnum || '', 10);
                    if (!Number.isNaN(qnum)) updateQuestionButtonStatus(qnum);
                    updatePartRowCounts();
                });

        // Helper to re-render the block after answer changes
        function rerenderBlock() {
            // Find the block data and context
            const blockData = ctx.sections
                ? (ctx.sections[ctx.sectionIndex]?.questions || ctx.sections[ctx.sectionIndex]?.blocks || []).find(b => b.id === blockId)
                : null;
            if (!blockData) return;
            // Find the render function
            const renderMatchingVisualBlock = window.renderMatchingVisualBlock || (window.candidateBlocks && window.candidateBlocks.renderMatchingVisualBlock);
            if (typeof renderMatchingVisualBlock === 'function') {
                const html = renderMatchingVisualBlock(blockData, answerCtx);
                // Replace the block's HTML
                const temp = document.createElement('div');
                temp.innerHTML = html;
                const newBlock = temp.firstElementChild;
                if (newBlock && block.parentNode) {
                    block.parentNode.replaceChild(newBlock, block);
                    // Re-setup event handlers for the new block
                    setupReadingBlockEventHandlers(newBlock, ctx);
                }
            }
        }

        zones.forEach(zone => {
                        // --- Drag over/drop logic ---
                        zone.addEventListener('dragover', (e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            zone.classList.add('is-over');
                        });
                        zone.addEventListener('dragleave', () => {
                            zone.classList.remove('is-over');
                        });
                        // --- Drop handler: place pill ---
                        zone.addEventListener('drop', (e) => {
                            e.preventDefault();
                            didDrop = true;
                            const optionLetter = e.dataTransfer.getData('text/plain');
                            const zoneNum = zone.dataset.zoneNum;
                            if (optionLetter && zoneNum) {
                                const matches = answerCtx.getAnswer(blockId) || {};
                                // Handle moving from one zone to another
                                const sourceZoneId = e.dataTransfer.getData('text/source-zone');
                                if (sourceZoneId && sourceZoneId !== zone.dataset.zoneId) {
                                    const srcEl = block.querySelector(`.mc-zone--gap[data-zone-id="${sourceZoneId}"]`);
                                    const srcNum = srcEl?.dataset.zoneNum;
                                    if (srcNum) delete matches[srcNum];
                                    if (srcEl) renderZoneEmpty(srcEl);
                                }
                                matches[zoneNum] = optionLetter;
                                answerCtx.setAnswer(blockId, matches);
                                renderZoneFilled(zone, optionLetter);
                                updateBankUsage(matches);
                                const qnum = parseInt(zone.dataset.qnum, 10);
                                if (!Number.isNaN(qnum)) updateQuestionButtonStatus(qnum);
                                updatePartRowCounts();
                            }
                            zone.classList.remove('is-over');
                        });
            // (Double-click to remove is now handled by click × button)
            // Initial bank usage update
            updateBankUsage(answerCtx.getAnswer(blockId) || {});
        });
    });

    // Handle matching-headings blocks (drag-drop to passage)
    questionsContent.querySelectorAll('.matching-headings-block').forEach(block => {
        const blockId = block.dataset.blockId;
        if (!blockId) return;

        // Find the headings in this block
        const pills = block.querySelectorAll('.matching-heading-pill');
        
        // Find drop zones in the passage
        const passageContent = document.getElementById('passageContent');
        if (!passageContent) return;
        
        const dropZones = passageContent.querySelectorAll('.mh-passage-drop-zone');
        
        // Make heading pills draggable
        pills.forEach(pill => {
            pill.addEventListener('dragstart', (e) => {
                const letter = pill.dataset.optionLetter;
                e.dataTransfer.effectAllowed = 'copy';
                e.dataTransfer.setData('mh-letter', letter);
                e.dataTransfer.setData('text/plain', letter);
            });
            
            pill.addEventListener('dragend', (e) => {
                // Clean up visual feedback
                dropZones.forEach(zone => {
                    zone.style.borderColor = '';
                    zone.style.backgroundColor = '';
                });
            });
        });

        // Setup drop zones to receive headings
        let draggingFromZone = null; // Track which zone is being dragged from
        
        dropZones.forEach(zone => {
            const slotId = zone.dataset.slotId;
            
            // Make drop zones draggable so items can be dragged out
            zone.addEventListener('dragstart', (e) => {
                const letter = zone.querySelector('span:first-child')?.textContent?.trim();
                if (letter && letter.match(/^[A-Z]$/)) {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('mh-letter', letter);
                    e.dataTransfer.setData('mh-slot-id', slotId);
                    draggingFromZone = { zone, slotId, letter };
                }
            });
            
            zone.addEventListener('dragend', (e) => {
                // If drag was not successful (dropped outside valid target), remove from zone
                if (draggingFromZone && draggingFromZone.slotId === slotId && e.dataTransfer.dropEffect === 'none') {
                    const letter = draggingFromZone.letter;
                    const currentMatches = answerCtx.getAnswer(blockId) || {};
                    
                    if (currentMatches[slotId] === letter) {
                        delete currentMatches[slotId];
                        answerCtx.setAnswer(blockId, currentMatches);
                        
                        // Clear the visual state and restore question number
                        zone.style.borderColor = '';
                        zone.style.backgroundColor = '';
                        const questionNumber = zone.getAttribute('data-question-number');
                        zone.innerHTML = questionNumber 
                            ? `<span class="mh-drop-zone-number" style="color: #0284c7; font-weight: 700; margin-right: 6px; font-size: 14px;">${questionNumber}</span><span style="color: #94a3b8; font-style: italic;">___</span>`
                            : '<span style="color: #94a3b8; font-style: italic;">___</span>';
                        
                        // Update question button status
                        const qnum = parseInt(zone.dataset.qnum, 10);
                        if (!Number.isNaN(qnum)) {
                            updateQuestionButtonStatus(qnum);
                        }
                        updatePartRowCounts();
                        
                        // Re-enable the pill
                        pills.forEach(pill => {
                            if (pill.dataset.optionLetter === letter) {
                                pill.draggable = true;
                                pill.style.opacity = '1';
                                pill.style.cursor = 'grab';
                                pill.style.pointerEvents = 'auto';
                            }
                        });
                    }
                }
                draggingFromZone = null;
            });
            
            // Double-click to remove the item from the drop zone
            zone.addEventListener('dblclick', (e) => {
                const letterSpan = zone.querySelector('span:first-child');
                const letter = letterSpan?.textContent?.trim();
                
                if (letter && letter.match(/^[A-Z]$/)) {
                    // Remove from saved answers
                    const currentMatches = answerCtx.getAnswer(blockId) || {};
                    delete currentMatches[slotId];
                    answerCtx.setAnswer(blockId, currentMatches);
                    
                    // Clear the visual state and restore question number
                    zone.style.borderColor = '';
                    zone.style.backgroundColor = '';
                    const questionNumber = zone.getAttribute('data-question-number');
                    zone.innerHTML = questionNumber 
                        ? `<span class="mh-drop-zone-number" style="color: #0284c7; font-weight: 700; margin-right: 6px; font-size: 14px;">${questionNumber}</span><span style="color: #94a3b8; font-style: italic;">___</span>`
                        : '<span style="color: #94a3b8; font-style: italic;">___</span>';
                    
                    // Update question button status
                    const qnum = parseInt(zone.dataset.qnum, 10);
                    if (!Number.isNaN(qnum)) {
                        updateQuestionButtonStatus(qnum);
                    }
                    updatePartRowCounts();
                    
                    // Re-enable the pill
                    pills.forEach(pill => {
                        if (pill.dataset.optionLetter === letter) {
                            pill.draggable = true;
                            pill.style.opacity = '1';
                            pill.style.cursor = 'grab';
                            pill.style.pointerEvents = 'auto';
                        }
                    });
                }
            });
            
            zone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
                zone.style.borderColor = '#0284c7';
                zone.style.backgroundColor = '#e0f2fe';
            });
            
            zone.addEventListener('dragleave', () => {
                zone.style.borderColor = '';
                zone.style.backgroundColor = '';
            });
            
            zone.addEventListener('drop', (e) => {
                e.preventDefault();
                const letter = e.dataTransfer.getData('mh-letter');
                const sourceSlotId = e.dataTransfer.getData('mh-slot-id');
                
                if (letter && slotId && answerCtx && typeof answerCtx.getAnswer === 'function' && typeof answerCtx.setAnswer === 'function') {
                    // Track active question
                    const qnum = parseInt(zone.dataset.qnum, 10);
                    if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                        testPageState.activeQuestionNumber = qnum;
                        renderQuestionRow(ctx);
                    }
                    
                    // Get current matches for this block
                    const currentMatches = answerCtx.getAnswer(blockId) || {};
                    
                    // If dragging from another drop zone, clear that zone
                    if (sourceSlotId && sourceSlotId !== slotId) {
                        delete currentMatches[sourceSlotId];
                    }
                    
                    // Update with the new match
                    currentMatches[slotId] = letter;
                    
                    // Save the answer
                    answerCtx.setAnswer(blockId, currentMatches);
                    
                    // Update visual state of the drop zone
                    zone.style.borderColor = '';
                    zone.style.backgroundColor = '';
                    
                    // Find the selected heading text from the block
                    const selectedPill = block.querySelector(`.matching-heading-pill[data-option-letter="${letter}"]`);
                    if (selectedPill) {
                        const selectedText = selectedPill.textContent.trim().replace(letter, '').trim();
                        zone.innerHTML = `<span style="color: #0284c7; font-weight: 700; margin-right: 6px;">${letter}</span><span style="color: #0c4a6e; word-break: break-word;">${selectedText}</span>`;
                    }
                    
                    // Update question button status
                    if (!Number.isNaN(qnum)) {
                        updateQuestionButtonStatus(qnum);
                    }
                    updatePartRowCounts();
                    
                    // Update the visual state of pills - mark used ones as disabled
                    pills.forEach(pill => {
                        const pillLetter = pill.dataset.optionLetter;
                        const isNowUsed = Object.values(currentMatches).includes(pillLetter);
                        
                        if (isNowUsed) {
                            pill.draggable = false;
                            pill.style.opacity = '0.5';
                            pill.style.cursor = 'default';
                            pill.style.pointerEvents = 'none';
                        } else {
                            pill.draggable = true;
                            pill.style.opacity = '1';
                            pill.style.cursor = 'grab';
                            pill.style.pointerEvents = 'auto';
                        }
                    });
                }
            });
        });
    });

    // Handle TFNG blocks (True/False/Not Given or Yes/No/Not Given)
    questionsContent.querySelectorAll('.tfng-option-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const blockId = e.target.dataset.blockId;
            const qid = e.target.dataset.qid;
            const value = e.target.value;
            if (blockId && qid && value) {
                answerCtx.setTfngAnswer(blockId, qid, value);
                
                // Track active question and update status
                const rowEl = e.target.closest('.tfng-row');
                if (rowEl) {
                    const qnum = parseInt(rowEl.dataset.qnum, 10);
                    if (!Number.isNaN(qnum)) {
                        if (testPageState.activeQuestionNumber !== qnum) {
                            testPageState.activeQuestionNumber = qnum;
                            renderQuestionRow(ctx);
                        }
                        updateQuestionButtonStatus(qnum);
                    }
                }
                updatePartRowCounts();
            }
        });
    });
}

function applyReadingGlobalNumbering(questionsContent, testDoc, sectionIndex) {
    // Helper to count questions in a block (matching Listening logic)
    const countBlockQuestions = (block) => {
        const type = (block?.type || '').toLowerCase();
        const data = block?.data || {};
        
        if (type === 'gap_fill') {
            const rawHtml = data.passageHtml || '';
            if (!rawHtml) return 0;
            const temp = document.createElement('div');
            temp.innerHTML = rawHtml;
            return temp.querySelectorAll('.gap-marker').length;
        }
        if (type === 'gap_fill_visual') {
            return Array.isArray(data.gaps) ? data.gaps.length : 0;
        }
        if (type === 'matching') {
            return Array.isArray(data.items) ? data.items.length : 0;
        }
        if (type === 'matching_headings') {
            return Array.isArray(data.slots) ? data.slots.length : 0;
        }
        if (type === 'matching_visual') {
            return Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0;
        }
        if (type === 'mcq_set') {
            const questions = Array.isArray(data.questions) ? data.questions : [];
            return questions.reduce((sum, q) => {
                // IMPROVED LOGIC
                let correctAnswerCount = q.correctAnswerCount;
                if (!correctAnswerCount) {
                    if (Array.isArray(q.correctIndices) && q.correctIndices.length > 0) {
                        correctAnswerCount = q.correctIndices.length;
                    } else {
                        correctAnswerCount = (q.allowMultiple ? 2 : 1);
                    }
                }
                return sum + correctAnswerCount;
            }, 0);
        }
        if (type === 'tfng') {
            return Array.isArray(data.questions) ? data.questions.length : 0;
        }
        return 0;
    };
    
    const countSectionQuestions = (section) => {
        const sectionBlocks = section?.questions || section?.blocks || [];
        if (!Array.isArray(sectionBlocks)) return 0;
        return sectionBlocks.reduce((sum, b) => sum + countBlockQuestions(b), 0);
    };
    
    // Get all sections from test
    let sections = testDoc?.data || testDoc?.sections || [];
    if (!Array.isArray(sections)) sections = [];
    
    // Calculate offset from previous sections
    const offset = sections.slice(0, sectionIndex)
        .reduce((sum, sec) => sum + countSectionQuestions(sec), 0);
    
    let counter = offset;
    
    // Get all rendered block elements
    const blockEls = Array.from(questionsContent.querySelectorAll(
        '.gap-block, .gap-visual-block, .matching-block, .matching-canvas-task, .matching-headings-block, .mcq-block, .tfng-block'
    ));
    
    // Get current section's blocks
    const currentSection = sections[sectionIndex];
    let blocks = currentSection?.questions || currentSection?.blocks || [];
    if (!Array.isArray(blocks)) blocks = [];
    
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
                if (nums[i]) nums[i].textContent = `${num}.`;
                itemEl.dataset.qnum = String(num);
                itemEl.dataset.qtype = 'matching';
                itemEl.classList.add('question-anchor');
            });
            return;
        }
        
        if (type === 'matching_headings') {
            // Drop zones are in the passage content, not questionsContent
            const passageContent = document.getElementById('passageContent');
            const zones = passageContent ? passageContent.querySelectorAll('.mh-passage-drop-zone') : [];
            zones.forEach((zoneEl) => {
                const num = ++counter;
                const numEl = zoneEl.querySelector('.mh-drop-zone-number');
                if (numEl) numEl.textContent = String(num);
                zoneEl.dataset.qnum = String(num);
                zoneEl.dataset.qtype = 'matching_headings';
                zoneEl.classList.add('question-anchor');
                // Also update the data attribute used for restoring numbers
                zoneEl.setAttribute('data-question-number', num);
            });
            return;
        }
        
        if (type === 'matching_visual') {
            const zones = blockEl.querySelectorAll('.mc-zone--gap');
            zones.forEach((zoneEl) => {
                const num = ++counter;
                const numEl = zoneEl.querySelector('.mc-zone-num');
                if (numEl) numEl.textContent = String(num);
                zoneEl.dataset.qnum = String(num);
                zoneEl.dataset.qtype = 'matching_visual';
                zoneEl.classList.add('question-anchor');
            });
            return;
        }
        
        if (type === 'mcq_set') {
            const nums = blockEl.querySelectorAll('.mcq-question-number');
            const questions = block.data?.questions || [];
            nums.forEach((numEl, i) => {
                const question = questions[i] || {};
                // FIXED LOGIC: Check correctIndices length first
                let correctAnswerCount = question.correctAnswerCount;
                if (!correctAnswerCount) {
                    if (Array.isArray(question.correctIndices) && question.correctIndices.length > 0) {
                        correctAnswerCount = question.correctIndices.length;
                    } else {
                        correctAnswerCount = question.allowMultiple ? 2 : 1;
                    }
                }

                // Assign consecutive numbers based on correct answer count
                const startNum = counter + 1;
                counter += correctAnswerCount;

                if (correctAnswerCount > 1) {
                    numEl.textContent = `${startNum}-${counter}`;
                } else {
                    numEl.textContent = String(startNum);
                }

                // Get the outer container div (parent of the div containing the span)
                const titleEl = numEl.closest('div')?.parentElement;
                if (titleEl) {
                    titleEl.dataset.qnum = String(startNum);
                    titleEl.dataset.qnumEnd = String(counter);
                    titleEl.dataset.qtype = 'mcq_set';
                    titleEl.classList.add('question-anchor');
                }
            });
            return;
        }
        
        if (type === 'tfng') {
            const rows = blockEl.querySelectorAll('.tfng-row');
            const nums = blockEl.querySelectorAll('.tfng-q-num');
            rows.forEach((rowEl, i) => {
                const num = ++counter;
                if (nums[i]) nums[i].textContent = String(num);
                rowEl.dataset.qnum = String(num);
                rowEl.dataset.qtype = 'tfng';
                rowEl.classList.add('question-anchor');
            });
        }
    });
}