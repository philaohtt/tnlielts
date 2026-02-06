import { blockRenderers } from "../../core/index.js";
import { showTestError, testPageState, countAnsweredQuestionsInSection } from "../app/candidate.test.controller.js";
import { escapeHtml } from "../app/candidate.utils.js";
import { getAnswer, saveAnswer } from "../answers/candidate.answers.store.js";

// Playlist audio state
let __tracks = [];
let __trackIndex = 0;
let __gapTimer = null;
let __extraTimer = null;
let __currentAudio = null;
let __audioPlan = { gapBetweenAudiosSec: 0, extraAfterAudioSec: 600 };
let __audioInitialized = false;

function getListeningTracks(testDoc) {
    if (Array.isArray(testDoc.audioList) && testDoc.audioList.length) {
        return testDoc.audioList.filter(a => a?.url);
    }
    if (testDoc.audio?.url) {
        return [testDoc.audio];
    }
    
    // Try both testDoc.sections and testDoc.data
    const sections = testDoc.sections || testDoc.data;
    if (Array.isArray(sections)) {
        const list = sections.map((s, idx) => {
            return s?.audio || s?.sectionAudio;
        }).filter(a => a?.url);
        if (list.length) {
            return list;
        }
    }
    return [];
}

function getAudioPlan(testDoc) {
    const gap = Number(testDoc.audioPlan?.gapBetweenAudiosSec ?? 0);
    const extra = Number(testDoc.audioPlan?.extraAfterAudioSec ?? 600);
    return { gapBetweenAudiosSec: Math.max(0, gap), extraAfterAudioSec: Math.max(0, extra) };
}

function clearAudioTimers() {
    if (__gapTimer) clearInterval(__gapTimer);
    if (__extraTimer) clearInterval(__extraTimer);
    __gapTimer = null;
    __extraTimer = null;
    if (__currentAudio) {
        __currentAudio.pause();
        __currentAudio = null;
    }
    // Hide audio gate if visible
    const audioGate = document.getElementById('audioGate');
    if (audioGate) {
        audioGate.style.display = 'none';
    }
}

export function stopListeningAudio() {
    clearAudioTimers();
    __audioInitialized = false;
}

function renderAudioPlayer(container) {
    container.innerHTML = '';
    container.style.display = 'flex';
    container.style.flexDirection = 'row';
    container.style.gap = '12px';
    container.style.alignItems = 'center';
    container.style.padding = '0';
    container.style.margin = '0';

    const statusRow = document.createElement('div');
    statusRow.id = 'audioStatus';
    statusRow.style.fontSize = '13px';
    statusRow.style.color = '#475569';
    statusRow.style.fontWeight = '600';
    statusRow.style.whiteSpace = 'nowrap';
    statusRow.textContent = '🎧 Ready';

    const volumeLabel = document.createElement('span');
    volumeLabel.textContent = 'Volume:';
    volumeLabel.style.fontSize = '12px';
    volumeLabel.style.color = '#64748b';
    volumeLabel.style.whiteSpace = 'nowrap';

    const volumeSlider = document.createElement('input');
    volumeSlider.type = 'range';
    volumeSlider.id = 'audioVolume';
    volumeSlider.min = '0';
    volumeSlider.max = '100';
    volumeSlider.value = '80';
    volumeSlider.style.width = '100px';

    container.appendChild(statusRow);
    container.appendChild(volumeLabel);
    container.appendChild(volumeSlider);

    // Setup audio element
    if (!__currentAudio) {
        __currentAudio = new Audio();
        __currentAudio.preload = 'metadata';
    }

    __currentAudio.src = __tracks[__trackIndex].url;
    __currentAudio.volume = volumeSlider.value / 100;

    // Volume control
    volumeSlider.oninput = () => {
        if (__currentAudio) __currentAudio.volume = volumeSlider.value / 100;
    };

    // Show audio gate modal
    const audioGate = document.getElementById('audioGate');
    const audioPlayBtn = document.getElementById('audioPlayBtn');
    
    if (audioGate && audioPlayBtn) {
        audioGate.style.display = 'flex';
        
        // Handle Play button click
        audioPlayBtn.onclick = () => {
            audioGate.style.display = 'none';
            
            __currentAudio.play().then(() => {
                statusRow.textContent = '🎧 Playing...';
                statusRow.style.color = '#059669';
            }).catch(err => {
                console.error('Audio play failed:', err);
                statusRow.textContent = '❌ Error';
                statusRow.style.color = '#dc2626';
            });
        };
    }

    // Handle track end
    __currentAudio.onended = () => {
        if (__trackIndex < __tracks.length - 1) {
            __trackIndex++;
            startGapCountdown(container, statusRow);
        } else {
            startExtraTimeCountdown(container, statusRow);
        }
    };

    // Load metadata
    __currentAudio.load();
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function startGapCountdown(container, statusRow) {
    let remaining = __audioPlan.gapBetweenAudiosSec;
    
    if (remaining === 0) {
        loadAndPlayNextTrack(container, statusRow);
        return;
    }

    statusRow.textContent = `⏳ Next in ${remaining}s`;
    statusRow.style.color = '#f59e0b';

    __gapTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(__gapTimer);
            __gapTimer = null;
            loadAndPlayNextTrack(container, statusRow);
        } else {
            statusRow.textContent = `⏳ Next in ${remaining}s`;
        }
    }, 1000);
}

function loadAndPlayNextTrack(container, statusRow) {
    if (__trackIndex >= __tracks.length) return;

    statusRow.textContent = '⏳ Loading...';
    statusRow.style.color = '#475569';

    __currentAudio.src = __tracks[__trackIndex].url;
    __currentAudio.load();

    __currentAudio.onloadedmetadata = () => {
        __currentAudio.play().then(() => {
            statusRow.textContent = '🎧 Playing...';
            statusRow.style.color = '#059669';
        }).catch(err => {
            console.error('Autoplay failed:', err);
            statusRow.textContent = '❌ Error';
            statusRow.style.color = '#dc2626';
        });
    };
}

function startExtraTimeCountdown(container, statusRow) {
    let remaining = __audioPlan.extraAfterAudioSec;
    
    statusRow.textContent = `✓ Audio complete`;
    statusRow.style.color = '#059669';

    __extraTimer = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(__extraTimer);
            __extraTimer = null;
            statusRow.textContent = '⏰ Time up';
            statusRow.style.color = '#dc2626';
            const navNext = document.getElementById('navNext');
            if (navNext) navNext.disabled = false;
        }
    }, 1000);
}

function renderListeningBlock(block, ctx) {
    if (!block || !block.type) {
        return `
            <div style="padding: 16px; background: #f9f9f9; border-radius: 8px; color: #666;">
                <div style="font-weight: 600; margin-bottom: 8px;">Block Type: unknown</div>
            </div>
        `;
    }
    const blockType = (block.type || '').toLowerCase().trim();
    const renderer = blockRenderers[blockType];
    if (renderer && typeof renderer === 'function') {
        try {
            return renderer(block, ctx);
        } catch (err) {
            console.error(`Error rendering ${blockType} block:`, err);
            return `
                <div style="padding: 16px; background: #fef2f2; border-radius: 8px; color: #dc2626;">
                    <div style="font-weight: 600; margin-bottom: 8px;">Rendering Error</div>
                    <div style="font-size: 12px;">${escapeHtml(err.message)}</div>
                </div>
            `;
        }
    }
    return `
        <div style="padding: 16px; background: #f9f9f9; border-radius: 8px; color: #666;">
            <div style="font-weight: 600; margin-bottom: 8px;">Block Type: ${escapeHtml(blockType)}</div>
            <div style="font-size: 12px; color: #999;">ID: ${escapeHtml(block.id || '')}</div>
        </div>
    `;
}

export function renderListeningTestUI() {
    const testDoc = testPageState.testDoc;
    if (!testDoc) {
        showTestError("Test document not loaded.");
        return;
    }

    let sections = testDoc.data || testDoc.sections || [];
    if (!Array.isArray(sections)) sections = [];

    if (sections.length === 0) {
        const questionsContent = document.getElementById('questionsContent');
        if (questionsContent) {
            questionsContent.innerHTML = '<div style="padding: 40px; color: #dc2626; background: #fef2f2; border-radius: 8px; text-align: center;"><strong>Error:</strong> No sections found in this test.</div>';
        }
        return;
    }

    if (typeof testPageState.sectionIndex !== 'number') testPageState.sectionIndex = 0;

    const currentSection = sections[testPageState.sectionIndex];
    if (!currentSection) {
        showTestError("Section not found.");
        return;
    }

    // Update banner with part title and instruction
    const partBannerTitle = document.getElementById('partBannerTitle');
    if (partBannerTitle) {
        const spans = partBannerTitle.querySelectorAll('span');
        if (spans.length > 0) {
            spans[0].textContent = `Part ${testPageState.sectionIndex + 1}`;
        }
    }
    const bannerCandidateName = document.getElementById('bannerCandidateName');
    if (bannerCandidateName) {
        bannerCandidateName.textContent = '';
    }

    const editorContent = document.getElementById('editorContent');
    const questionsContent = document.getElementById('questionsContent');
    
    if (editorContent) editorContent.style.display = 'none';
    if (questionsContent) questionsContent.style.display = 'block';

    const instructionsText = currentSection.instructions || currentSection.instructionsText || '';
    const instructionsEl = document.getElementById('instructionsText');
    if (instructionsEl) instructionsEl.textContent = instructionsText;

    // Initialize playlist audio player (only once)
    if (!__audioInitialized) {
        __tracks = getListeningTracks(testDoc);
        __audioPlan = getAudioPlan(testDoc);
        __trackIndex = 0;
        clearAudioTimers();

        const audioBarPlaceholder = document.getElementById('audioBarPlaceholder');
        
        if (audioBarPlaceholder) {
            if (__tracks.length === 0) {
                audioBarPlaceholder.textContent = 'Audio: Not available';
                audioBarPlaceholder.style.display = 'flex';
            } else {
                renderAudioPlayer(audioBarPlaceholder);
                __audioInitialized = true;
            }
        }
    }

    let blocks = currentSection.questions || currentSection.blocks || [];
    if (!Array.isArray(blocks)) blocks = [];
    
    if (blocks.length === 0) {
        if (questionsContent) {
            questionsContent.innerHTML = '<div style="padding: 40px; color: #dc2626; background: #fef2f2; border-radius: 8px; text-align: center;"><strong>Error:</strong> No question blocks in this section.</div>';
        }
        return;
    }

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
        if (type === 'matching_visual') {
            return Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0;
        }
        if (type === 'mcq_set') {
            const questions = Array.isArray(data.questions) ? data.questions : [];
            return questions.reduce((sum, q) => sum + (q.correctAnswerCount || (q.allowMultiple ? 2 : 1)), 0);
        }
        return 0;
    };

    const countSectionQuestions = (section) => {
        const sectionBlocks = section?.questions || section?.blocks || [];
        if (!Array.isArray(sectionBlocks)) return 0;
        return sectionBlocks.reduce((sum, b) => sum + countBlockQuestions(b), 0);
    };

    if (questionsContent) {
        const ctx = {
            getAnswer: (blockId) => {
                // Support both gap-fill and matching blocks
                if (blockId && blockId.includes('matching')) {
                    return getAnswer({ skill: 'listening', testId: testPageState.testId, type: 'matching', id: blockId });
                }
                return getAnswer({ skill: 'listening', testId: testPageState.testId, type: 'gap', id: blockId });
            },
            setAnswer: (blockId, value) => {
                // Support both gap-fill and matching blocks
                if (blockId && blockId.includes('matching')) {
                    saveAnswer({ skill: 'listening', testId: testPageState.testId, type: 'matching', id: blockId, value });
                } else {
                    saveAnswer({ skill: 'listening', testId: testPageState.testId, type: 'gap', id: blockId, value });
                }
            },
            getMcqAnswer: (blockId, questionId) => getAnswer({ skill: 'listening', testId: testPageState.testId, type: 'mcq', id: `${blockId}:${questionId}` }),
            setMcqAnswer: (blockId, questionId, value) => saveAnswer({ skill: 'listening', testId: testPageState.testId, type: 'mcq', id: `${blockId}:${questionId}`, value })
        };

        if (!document.getElementById('listening-gap-style')) {
            const style = document.createElement('style');
            style.id = 'listening-gap-style';
            style.textContent = `
                body.mode-listening #questionsContent {
                    max-width: 980px;
                    margin: 0;
                    padding: 0 12px 24px 12px;
                }
                body.mode-listening #questionsContent .gap-block,
                body.mode-listening #questionsContent .gap-visual-block,
                body.mode-listening #questionsContent .matching-block,
                body.mode-listening #questionsContent .matching-canvas-task,
                body.mode-listening #questionsContent .mcq-block {
                    max-width: 980px;
                    margin: 0;
                }
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
                body.mode-listening #questionsContent .matching-block > div[style*="grid-template-columns"] {
                    grid-template-columns: minmax(320px, 1.1fr) minmax(260px, 0.9fr) !important;
                    gap: 16px !important;
                    max-width: 980px;
                    margin: 0;
                }
                @media (max-width: 900px) {
                    body.mode-listening #questionsContent .matching-block > div[style*="grid-template-columns"] {
                        grid-template-columns: 1fr !important;
                    }
                }
                .block-separator { margin: 32px 0; border-top: 2px solid #e2e8f0; }
                
                .gap-visual-block { font-family: Arial, sans-serif; color: #333; margin-top: 20px; }
                .cbt-instruction-box { background-color: #f3f9ff; border: 1px solid #c2e0ff; padding: 15px; margin-bottom: 20px; border-radius: 4px; line-height: 1.5; }
                .map-numbering-text { font-weight: bold; display: block; margin-bottom: 4px; font-size: 15px; }
                .map-instruction-content { font-size: 15px; font-style: italic; color: #444; }
                .map-stage { max-width: 900px; margin: 0; padding: 0 5px; }
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
                .mc-layout { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 14px; margin-top: 16px; align-items: start; max-width: 980px; margin-left: 0; margin-right: 0; }
                @media (max-width: 900px) {
                    .mc-layout { grid-template-columns: 1fr; }
                }
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

                /* Right-side question navigation (Listening only) */
                #listeningRightNav { display: none; }
                body.mode-listening #listeningRightNav { display: flex; }
                .listening-nav-float {
                    position: fixed;
                    right: 20px;
                    bottom: 120px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                    z-index: 30;
                }
                .listening-nav-btn {
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
                .listening-nav-btn:disabled {
                    background: #ddd;
                    color: #fff;
                    cursor: not-allowed;
                    box-shadow: none;
                }
            `;
            document.head.appendChild(style);
        }

        try {
            // Render ALL blocks in the section, not just one
            const renderedBlocks = blocks.map((block, index) => {
                const blockHtml = renderListeningBlock(block, ctx);
                // Add separator between blocks (except after the last one)
                if (index < blocks.length - 1) {
                    return blockHtml + '<div class="block-separator"></div>';
                }
                return blockHtml;
            }).join('');
            
            questionsContent.innerHTML = renderedBlocks;

            // Apply global numbering across blocks (whole test order)
            const offset = sections.slice(0, testPageState.sectionIndex)
                .reduce((sum, sec) => sum + countSectionQuestions(sec), 0);
            let counter = offset;

            const blockEls = Array.from(questionsContent.querySelectorAll(
                '.gap-block, .gap-visual-block, .matching-block, .matching-canvas-task, .mcq-block'
            ));

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
                    nums.forEach((numEl, qIdx) => {
                        const question = questions[qIdx] || {};
                        const correctAnswerCount = question.correctAnswerCount || (question.allowMultiple ? 2 : 1);
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
                }
            });

            const totalQuestions = sections.reduce((sum, sec) => sum + countSectionQuestions(sec), 0);
            if (!testPageState.activeQuestionNumber) {
                testPageState.activeQuestionNumber = Math.max(1, offset + 1);
            }
            if (testPageState.activeQuestionNumber > totalQuestions) {
                testPageState.activeQuestionNumber = totalQuestions;
            }

            const getQuestionStatus = (el) => {
                const type = el.dataset.qtype;
                if (type === 'gap_fill') {
                    const input = el.querySelector('.gap-input');
                    return !!(input && input.value.trim());
                }
                if (type === 'gap_fill_visual') {
                    const input = el.querySelector('.map-input');
                    return !!(input && input.value.trim());
                }
                if (type === 'matching') {
                    return !!el.querySelector('.matching-match-text');
                }
                if (type === 'matching_visual') {
                    return !!el.querySelector('.mc-placed-pill');
                }
                if (type === 'mcq_set') {
                    return !!el.querySelector('input.mcq-option-input:checked');
                }
                return false;
            };

            const refreshFooterAndActive = (scrollIntoView = false) => {
                const questionEls = Array.from(questionsContent.querySelectorAll('.question-anchor'));
                const answeredMap = new Map();
                questionEls.forEach(el => {
                    const num = parseInt(el.dataset.qnum, 10);
                    if (Number.isNaN(num)) return;
                    answeredMap.set(num, getQuestionStatus(el));
                    el.classList.toggle('question-active', num === testPageState.activeQuestionNumber);
                });

                const partRow = document.getElementById('partRow');
                const questionRow = document.getElementById('questionRow');
                if (partRow) {
                    let running = 0;
                    partRow.innerHTML = sections.map((sec, idx) => {
                        const count = countSectionQuestions(sec);
                        const start = running + 1;
                        const end = running + count;
                        
                        // Count answered questions by checking storage instead of DOM
                        const answered = countAnsweredQuestionsInSection(sec, testPageState.testId, 'listening');
                        
                        running = end;
                        return `<div class="part-pill ${idx === testPageState.sectionIndex ? 'active' : ''}" data-part-idx="${idx}">
                            <span>Part ${idx + 1}</span>
                            <span class="part-count">${answered} of ${count}</span>
                        </div>`;
                    }).join('');
                }

                if (questionRow) {
                    // Build question cards matching reading design
                    const blocks = currentSection.blocks || currentSection.questions || [];
                    let currentGlobalNum = 1;
                    for (let i = 0; i < testPageState.sectionIndex; i++) {
                        currentGlobalNum += countSectionQuestions(sections[i]);
                    }
                    
                    const cards = [];
                    
                    blocks.forEach(block => {
                        const type = (block?.type || '').toLowerCase();
                        const data = block?.data || {};
                        
                        if (type === 'mcq_set') {
                            // Handle MCQ questions with potential multi-answer
                            const questions = Array.isArray(data.questions) ? data.questions : [];
                            questions.forEach(q => {
                                const correctAnswerCount = q.correctAnswerCount || (q.allowMultiple ? 2 : 1);
                                const startNum = currentGlobalNum;
                                const endNum = currentGlobalNum + correctAnswerCount - 1;
                                
                                const numberDisplay = correctAnswerCount > 1 ? `${startNum}-${endNum}` : `${startNum}`;
                                const isActive = currentGlobalNum === testPageState.activeQuestionNumber;
                                const answered = answeredMap.get(currentGlobalNum);
                                
                                cards.push(`<button class="question-num-btn ${isActive ? 'active' : ''} ${answered ? 'has-answer' : ''}" data-qnum="${startNum}" title="Question ${numberDisplay}">${numberDisplay}</button>`);
                                currentGlobalNum += correctAnswerCount;
                            });
                        } else {
                            // Count questions in non-MCQ blocks
                            let blockQuestionCount = 0;
                            if (type === 'gap_fill') {
                                const temp = document.createElement('div');
                                temp.innerHTML = data.passageHtml || '';
                                blockQuestionCount = temp.querySelectorAll('.gap-marker').length;
                            } else if (type === 'gap_fill_visual') {
                                blockQuestionCount = Array.isArray(data.gaps) ? data.gaps.length : 0;
                            } else if (type === 'matching') {
                                blockQuestionCount = Array.isArray(data.items) ? data.items.length : 0;
                            } else if (type === 'matching_visual') {
                                blockQuestionCount = Array.isArray(data.zones) ? data.zones.filter(z => z && z.kind === 'gap').length : 0;
                            } else if (type === 'tfng') {
                                blockQuestionCount = Array.isArray(data.questions) ? data.questions.length : 0;
                            }
                            
                            // Render individual question buttons
                            for (let i = 0; i < blockQuestionCount; i++) {
                                const isActive = currentGlobalNum === testPageState.activeQuestionNumber;
                                const answered = answeredMap.get(currentGlobalNum);
                                
                                cards.push(`<button class="question-num-btn ${isActive ? 'active' : ''} ${answered ? 'has-answer' : ''}" data-qnum="${currentGlobalNum}">${currentGlobalNum}</button>`);
                                currentGlobalNum++;
                            }
                        }
                    });
                    
                    questionRow.innerHTML = cards.join('');
                }

                if (scrollIntoView) {
                    const target = questionsContent.querySelector(`.question-anchor[data-qnum="${testPageState.activeQuestionNumber}"]`);
                    if (target && typeof target.scrollIntoView === 'function') {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }

                updateRightNavButtons();
            };

            const updateRightNavButtons = () => {
                const totalQuestions = sections.reduce((sum, sec) => sum + countSectionQuestions(sec), 0);
                const currentNum = testPageState.activeQuestionNumber || 1;

                let nav = document.getElementById('listeningRightNav');
                if (!nav) {
                    nav = document.createElement('div');
                    nav.id = 'listeningRightNav';
                    nav.className = 'listening-nav-float';
                    nav.innerHTML = `
                        <button class="listening-nav-btn" id="listeningPrevBtn" aria-label="Previous question">←</button>
                        <button class="listening-nav-btn" id="listeningNextBtn" aria-label="Next question">→</button>
                    `;
                    document.body.appendChild(nav);

                    nav.addEventListener('click', (e) => {
                        if (e.target.id === 'listeningPrevBtn') {
                            const current = testPageState.activeQuestionNumber || 1;
                            if (current > 1) {
                                const nextNum = current - 1;
                                testPageState.activeQuestionNumber = nextNum;

                                // Switch to previous section if crossing boundary
                                let running = 0;
                                for (let i = 0; i < sections.length; i++) {
                                    const count = countSectionQuestions(sections[i]);
                                    const start = running + 1;
                                    const end = running + count;
                                    if (nextNum >= start && nextNum <= end) {
                                        if (testPageState.sectionIndex !== i) {
                                            testPageState.sectionIndex = i;
                                            renderListeningTestUI();
                                            return;
                                        }
                                        break;
                                    }
                                    running = end;
                                }

                                refreshFooterAndActive(true);
                            }
                        } else if (e.target.id === 'listeningNextBtn') {
                            const current = testPageState.activeQuestionNumber || 1;
                            if (current < totalQuestions) {
                                const nextNum = current + 1;
                                testPageState.activeQuestionNumber = nextNum;

                                // Switch to next section if crossing boundary
                                let running = 0;
                                for (let i = 0; i < sections.length; i++) {
                                    const count = countSectionQuestions(sections[i]);
                                    const start = running + 1;
                                    const end = running + count;
                                    if (nextNum >= start && nextNum <= end) {
                                        if (testPageState.sectionIndex !== i) {
                                            testPageState.sectionIndex = i;
                                            renderListeningTestUI();
                                            return;
                                        }
                                        break;
                                    }
                                    running = end;
                                }

                                refreshFooterAndActive(true);
                            }
                        }
                    });
                }

                const prevBtn = nav.querySelector('#listeningPrevBtn');
                const nextBtn = nav.querySelector('#listeningNextBtn');
                if (prevBtn) prevBtn.disabled = currentNum <= 1;
                if (nextBtn) nextBtn.disabled = currentNum >= totalQuestions;
            };

            refreshFooterAndActive(true);

            const questionRow = document.getElementById('questionRow');
            if (questionRow) {
                questionRow.onclick = (e) => {
                    const btn = e.target.closest('.question-num-btn');
                    if (!btn) return;
                    const num = parseInt(btn.dataset.qnum, 10);
                    if (!Number.isNaN(num)) {
                        testPageState.activeQuestionNumber = num;
                        refreshFooterAndActive(true);
                    }
                };
            }

            const partRow = document.getElementById('partRow');
            if (partRow) {
                partRow.onclick = (e) => {
                    const pill = e.target.closest('.part-pill');
                    if (!pill) return;
                    const idx = parseInt(pill.dataset.partIdx, 10);
                    if (Number.isNaN(idx) || idx === testPageState.sectionIndex) return;
                    testPageState.sectionIndex = idx;
                    let start = 1;
                    for (let i = 0; i < idx; i++) start += countSectionQuestions(sections[i]);
                    testPageState.activeQuestionNumber = start;
                    renderListeningTestUI();
                };
            }

            testPageState.__refreshListeningFooter = refreshFooterAndActive;
        } catch (err) {
            console.error('Block rendering error:', err);
            questionsContent.innerHTML = `<div style="padding: 16px; background: #fef2f2; border-radius: 8px; color: #dc2626;"><strong>Rendering Error:</strong> ${escapeHtml(err.message)}</div>`;
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
                        if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                    }
                }
            });
            
            // Toggle number visibility on input
            input.addEventListener('input', (e) => {
                ctx.setAnswer(gapId, e.target.value);
                const wrap = e.target.closest('.gap-input-wrap');
                if (wrap) {
                    const numSpan = wrap.querySelector('.gap-num');
                    if (numSpan) {
                        numSpan.style.display = e.target.value ? 'none' : '';
                    }
                }
                if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
            });
        });

        // Handle map-input fields for visual gap fills
        questionsContent.querySelectorAll('.map-input').forEach(input => {
            const gapId = input.dataset.gapId;
            const qnum = input.dataset.qnum;
            if (!gapId) return;
            
            // Track active question on focus
            input.addEventListener('focus', (e) => {
                const box = e.target.closest('.map-gap-box');
                if (box) {
                    const qnum = parseInt(box.dataset.qnum, 10);
                    if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                        testPageState.activeQuestionNumber = qnum;
                        if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                    }
                }
            });
            
            // Toggle number visibility on input
            input.addEventListener('input', (e) => {
                ctx.setAnswer(gapId, e.target.value);
                const box = e.target.closest('.map-gap-box');
                if (box) {
                    const numSpan = box.querySelector('.gap-number');
                    if (numSpan) {
                        numSpan.style.display = e.target.value ? 'none' : '';
                    }
                }
                if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
            });
        });

        questionsContent.querySelectorAll('.mcq-option-input').forEach(input => {
            input.addEventListener('change', (e) => {
                const blockId = e.target.dataset.blockId;
                const qid = e.target.dataset.qid;
                const optIdx = parseInt(e.target.dataset.optIdx, 10);
                if (!blockId || !qid || Number.isNaN(optIdx)) return;

                // Track active question
                const questionEl = e.target.closest('[data-qnum][data-qtype="mcq_set"]');
                if (questionEl) {
                    const qnum = parseInt(questionEl.dataset.qnum, 10);
                    if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                        testPageState.activeQuestionNumber = qnum;
                    }
                }

                if (e.target.type === 'radio') {
                    ctx.setMcqAnswer(blockId, qid, optIdx);
                } else {
                    const group = questionsContent.querySelectorAll(`.mcq-option-input[type="checkbox"][data-block-id="${blockId}"][data-qid="${qid}"]`);
                    const selected = Array.from(group).filter(i => i.checked).map(i => parseInt(i.dataset.optIdx, 10)).filter(n => !Number.isNaN(n));
                    ctx.setMcqAnswer(blockId, qid, selected);
                }
                if (testPageState.__refreshListeningFooter) {
                    testPageState.__refreshListeningFooter(false);
                }
            });
        });

        // Setup matching block drag-and-drop
        questionsContent.querySelectorAll('.matching-block').forEach(block => {
            const blockId = block.dataset.blockId;
            const allowReuse = block.dataset.allowReuse === 'true';
            if (!blockId) return;

            const options = block.querySelectorAll('.matching-option');
            const selectedAreas = block.querySelectorAll('.matching-selected-area');
            const items = block.querySelectorAll('.matching-item');

            options.forEach(option => {
                option.addEventListener('dragstart', (e) => {
                    // Check if draggable is disabled (string "false" or boolean false)
                    if (option.draggable === false || option.getAttribute('draggable') === 'false') {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', option.dataset.optionLetter);
                    option.style.opacity = '0.5';
                });

                option.addEventListener('dragend', (e) => {
                    option.style.opacity = '1';
                });
            });

            selectedAreas.forEach(area => {
                // Enable dragging OUT of drop zone to clear
                area.addEventListener('dragstart', (e) => {
                    const hasMatch = area.querySelector('.matching-match-text');
                    if (hasMatch) {
                        e.dataTransfer.effectAllowed = 'move';
                        e.dataTransfer.setData('text/plain', 'clear-match');
                        area.style.opacity = '0.5';
                    } else {
                        e.preventDefault();
                    }
                });

                area.addEventListener('dragend', (e) => {
                    area.style.opacity = '1';
                    // If drag ended outside drop zone, clear the match
                    if (e.dataTransfer.dropEffect === 'none') {
                        const hasMatch = area.querySelector('.matching-match-text');
                        if (hasMatch) {
                            const itemNum = parseInt(area.dataset.itemNum, 10);
                            if (!Number.isNaN(itemNum)) {
                                const matches = ctx.getAnswer(blockId) || {};
                                const clearedLetter = matches[itemNum];
                                delete matches[itemNum];
                                ctx.setAnswer(blockId, matches);
                                if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                                
                                // Reset display
                                area.innerHTML = '<span style="font-size: 13px;">Drop option here</span>';
                                area.style.color = '#999';
                                area.style.fontWeight = '400';
                                area.style.background = '#f8fafc';
                                area.style.borderColor = '#cbd5e1';
                                
                                // Update matching item styling
                                const matchingItem = area.closest('.matching-item');
                                if (matchingItem) {
                                    matchingItem.style.borderColor = '#e2e8f0';
                                    matchingItem.style.background = '#fff';
                                }
                                
                                // Re-enable option if not allowing reuse
                                if (!allowReuse && clearedLetter) {
                                    const reuseOption = block.querySelector(`.matching-option[data-option-letter="${clearedLetter}"]`);
                                    if (reuseOption) {
                                        reuseOption.style.opacity = '1';
                                        reuseOption.style.borderColor = '#2563eb';
                                        reuseOption.style.background = '#f0f9ff';
                                        reuseOption.style.color = '#1a202c';
                                        reuseOption.setAttribute('draggable', 'true');
                                        reuseOption.style.cursor = 'move';
                                    }
                                }
                            }
                        }
                    }
                });

                area.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    area.style.background = '#dbeafe';
                    area.style.borderColor = '#0ea5e9';
                });

                area.addEventListener('dragleave', (e) => {
                    const hasMatch = area.querySelector('.matching-match-text');
                    area.style.background = hasMatch ? '#e0f2fe' : '#f8fafc';
                    area.style.borderColor = hasMatch ? '#0ea5e9' : '#cbd5e1';
                });

                area.addEventListener('drop', (e) => {
                    e.preventDefault();
                    const optionLetter = e.dataTransfer.getData('text/plain');
                    const itemNum = parseInt(area.dataset.itemNum, 10);
                    
                    if (optionLetter && !Number.isNaN(itemNum)) {
                        // Track active question
                        const matchingItem = area.closest('.matching-item');
                        if (matchingItem) {
                            const qnum = parseInt(matchingItem.dataset.qnum, 10);
                            if (!Number.isNaN(qnum) && testPageState.activeQuestionNumber !== qnum) {
                                testPageState.activeQuestionNumber = qnum;
                            }
                        }
                        
                        const matches = ctx.getAnswer(blockId) || {};
                        matches[itemNum] = optionLetter;
                        ctx.setAnswer(blockId, matches);
                        if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                        
                        // Find the option text from the dragged element
                        const draggedOption = block.querySelector(`.matching-option[data-option-letter="${optionLetter}"]`);
                        const optionText = draggedOption ? draggedOption.textContent.replace(/^[A-Z]\.\s*/, '') : optionLetter;
                        
                        // Update the display with text only
                        area.innerHTML = `<span class="matching-match-text" style="flex: 1; font-size: 13px;">${escapeHtml(optionText)}</span>`;
                        area.setAttribute('draggable', 'true');
                        area.style.color = '#1a202c';
                        area.style.fontWeight = '600';
                        area.style.background = '#e0f2fe';
                        area.style.borderColor = '#0ea5e9';
                        area.style.cursor = 'grab';
                        
                        // Update matching item styling
                        if (matchingItem) {
                            matchingItem.style.borderColor = '#dbeafe';
                            matchingItem.style.background = '#f0f9ff';
                        }
                        
                        // Remove option if not allowing reuse
                        if (!allowReuse) {
                            draggedOption.style.opacity = '0.6';
                            draggedOption.style.borderColor = '#cbd5e1';
                            draggedOption.style.background = '#f3f4f6';
                            draggedOption.style.color = '#999';
                            draggedOption.setAttribute('draggable', 'false');
                            draggedOption.style.cursor = 'not-allowed';
                        }
                    }
                    
                    area.style.background = '#e0f2fe';
                    area.style.borderColor = '#0ea5e9';
                });

                // Double-click to clear
                area.addEventListener('dblclick', (e) => {
                    const hasMatch = area.querySelector('.matching-match-text');
                    if (hasMatch) {
                        const itemNum = parseInt(area.dataset.itemNum, 10);
                        if (!Number.isNaN(itemNum)) {
                            const matches = ctx.getAnswer(blockId) || {};
                            const clearedLetter = matches[itemNum];
                            delete matches[itemNum];
                            ctx.setAnswer(blockId, matches);
                            if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                            
                            // Reset display
                            area.innerHTML = '<span style="font-size: 13px;">Drop option here</span>';
                            area.setAttribute('draggable', 'false');
                            area.style.color = '#999';
                            area.style.fontWeight = '400';
                            area.style.background = '#f8fafc';
                            area.style.borderColor = '#cbd5e1';
                            area.style.cursor = 'default';
                            
                            // Update matching item styling
                            const matchingItem = area.closest('.matching-item');
                            if (matchingItem) {
                                matchingItem.style.borderColor = '#e2e8f0';
                                matchingItem.style.background = '#fff';
                            }
                            
                            // Re-enable option if not allowing reuse
                            if (!allowReuse && clearedLetter) {
                                const reuseOption = block.querySelector(`.matching-option[data-option-letter="${clearedLetter}"]`);
                                if (reuseOption) {
                                    reuseOption.style.opacity = '1';
                                    reuseOption.style.borderColor = '#2563eb';
                                    reuseOption.style.background = '#f0f9ff';
                                    reuseOption.style.color = '#1a202c';
                                    reuseOption.setAttribute('draggable', 'true');
                                    reuseOption.style.cursor = 'move';
                                }
                            }
                        }
                    }
                });

                // Drag out to clear
                let draggedOverArea = null;
                area.addEventListener('dragenter', (e) => {
                    draggedOverArea = area;
                });

                area.addEventListener('dragleave', (e) => {
                    if (e.target === area || !area.contains(e.relatedTarget)) {
                        draggedOverArea = null;
                    }
                });
            });
        });

        // Setup matching visual block drag-and-drop
        questionsContent.querySelectorAll('.matching-canvas-task').forEach(task => {
            const blockId = task.dataset.blockId;
            const allowReuse = task.dataset.allowReuse === 'true';
            if (!blockId) return;

            const zones = task.querySelectorAll('.mc-zone--gap');
            const pills = task.querySelectorAll('.mc-pill');
            let didDrop = false;
            let lastDragSourceZoneId = null;

            const updateBankUsage = (matches) => {
                if (allowReuse) return;
                const usedIds = new Set(Object.values(matches || {}));
                pills.forEach(pill => {
                    const used = usedIds.has(pill.dataset.optionLetter);
                    pill.classList.toggle('used', used);
                    pill.setAttribute('draggable', used ? 'false' : 'true');
                    pill.style.opacity = used ? '0.4' : '1';
                    pill.style.cursor = used ? 'default' : 'grab';
                });
            };

            const renderZoneEmpty = (zoneEl) => {
                const zoneNum = zoneEl.dataset.zoneNum || '';
                zoneEl.classList.remove('has-answer');
                zoneEl.innerHTML = `<div class="mc-zone-num">${escapeHtml(zoneNum)}</div>`;
            };

            const renderZoneFilled = (zoneEl, optionLetter, optionText) => {
                zoneEl.classList.add('has-answer');
                zoneEl.innerHTML = `
                    <div class="mc-placed-pill" data-option-letter="${escapeHtml(optionLetter)}" draggable="true">
                        <span>${escapeHtml(optionText || '')}</span>
                        <button class="mc-clr" data-zone-id="${escapeHtml(zoneEl.dataset.zoneId)}">×</button>
                    </div>
                `;
            };

            pills.forEach(pill => {
                pill.addEventListener('dragstart', (e) => {
                    if (pill.classList.contains('used') && !allowReuse) {
                        e.preventDefault();
                        return;
                    }
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData('text/plain', pill.dataset.optionLetter);
                    pill.classList.add('dragging');
                });

                pill.addEventListener('dragend', () => {
                    pill.classList.remove('dragging');
                });
            });

            task.addEventListener('dragstart', (e) => {
                const placed = e.target.closest('.mc-placed-pill');
                if (!placed) return;
                const zone = placed.closest('.mc-zone--gap');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', placed.dataset.optionLetter);
                if (zone?.dataset.zoneId) {
                    e.dataTransfer.setData('text/source-zone', zone.dataset.zoneId);
                }
                lastDragSourceZoneId = zone?.dataset.zoneId || null;
                didDrop = false;
                placed.classList.add('dragging');
            });

            task.addEventListener('dragend', (e) => {
                const placed = e.target.closest('.mc-placed-pill');
                if (placed) placed.classList.remove('dragging');
                if (!didDrop && lastDragSourceZoneId) {
                    const matches = ctx.getAnswer(blockId) || {};
                    const sourceZoneEl = task.querySelector(`.mc-zone--gap[data-zone-id="${lastDragSourceZoneId}"]`);
                    const sourceZoneNum = sourceZoneEl?.dataset.zoneNum;
                    if (sourceZoneNum) {
                        delete matches[sourceZoneNum];
                        ctx.setAnswer(blockId, matches);
                        if (sourceZoneEl) renderZoneEmpty(sourceZoneEl);
                        updateBankUsage(matches);
                        if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                    }
                }
                lastDragSourceZoneId = null;
            });

            zones.forEach(zone => {
                zone.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    zone.classList.add('is-over');
                });

                zone.addEventListener('dragleave', () => {
                    zone.classList.remove('is-over');
                });

                zone.addEventListener('drop', (e) => {
                    e.preventDefault();
                    zone.classList.remove('is-over');

                    const optionLetter = e.dataTransfer.getData('text/plain');
                    const sourceZoneId = e.dataTransfer.getData('text/source-zone');
                    if (!optionLetter) return;

                    didDrop = true;

                    const matches = ctx.getAnswer(blockId) || {};
                    const targetZoneId = zone.dataset.zoneId;
                    const targetZoneNum = zone.dataset.zoneNum;
                    if (!targetZoneNum) return;

                    if (sourceZoneId && sourceZoneId !== targetZoneId) {
                        const sourceZoneEl = task.querySelector(`.mc-zone--gap[data-zone-id="${sourceZoneId}"]`);
                        const sourceZoneNum = sourceZoneEl?.dataset.zoneNum;
                        if (sourceZoneNum) delete matches[sourceZoneNum];
                        if (sourceZoneEl) renderZoneEmpty(sourceZoneEl);
                    }

                    if (!allowReuse) {
                        const existingZoneNum = Object.keys(matches).find(znum => matches[znum] === optionLetter);
                        if (existingZoneNum && existingZoneNum !== targetZoneNum) {
                            delete matches[existingZoneNum];
                            const existingZoneEl = Array.from(task.querySelectorAll('.mc-zone--gap')).find(z => z.dataset.zoneNum === existingZoneNum);
                            if (existingZoneEl) renderZoneEmpty(existingZoneEl);
                        }
                    }

                    matches[targetZoneNum] = optionLetter;
                    ctx.setAnswer(blockId, matches);

                    const bankPill = task.querySelector(`.mc-pill[data-option-letter="${optionLetter}"]`);
                    const optionText = bankPill ? bankPill.textContent : optionLetter;
                    renderZoneFilled(zone, optionLetter, optionText);
                    updateBankUsage(matches);
                    if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
                });
            });

            task.addEventListener('click', (e) => {
                const btn = e.target.closest('.mc-clr');
                if (!btn) return;
                const zoneId = btn.dataset.zoneId;
                if (!zoneId) return;

                const matches = ctx.getAnswer(blockId) || {};
                const zoneEl = task.querySelector(`.mc-zone--gap[data-zone-id="${zoneId}"]`);
                const zoneNum = zoneEl?.dataset.zoneNum;
                if (zoneNum) delete matches[zoneNum];
                ctx.setAnswer(blockId, matches);
                if (zoneEl) renderZoneEmpty(zoneEl);
                updateBankUsage(matches);
                if (testPageState.__refreshListeningFooter) testPageState.__refreshListeningFooter(false);
            });

            updateBankUsage(ctx.getAnswer(blockId) || {});
        });
    }

    const navPrev = document.getElementById('navPrev');
    const navNext = document.getElementById('navNext');

    const totalQuestions = sections.reduce((sum, sec) => sum + countSectionQuestions(sec), 0);
    const findSectionByQuestion = (qnum) => {
        let running = 0;
        for (let i = 0; i < sections.length; i++) {
            const count = countSectionQuestions(sections[i]);
            const start = running + 1;
            const end = running + count;
            if (qnum >= start && qnum <= end) {
                return { sectionIndex: i, start, end };
            }
            running = end;
        }
        return { sectionIndex: sections.length - 1, start: Math.max(1, running), end: running };
    };

    if (navPrev) {
        navPrev.onclick = () => {
            const current = testPageState.activeQuestionNumber || 1;
            const targetNum = Math.max(1, current - 1);
            const target = findSectionByQuestion(targetNum);
            testPageState.activeQuestionNumber = targetNum;
            if (target.sectionIndex !== testPageState.sectionIndex) {
                testPageState.sectionIndex = target.sectionIndex;
                renderListeningTestUI();
            } else if (testPageState.__refreshListeningFooter) {
                testPageState.__refreshListeningFooter(true);
            }
        };
        navPrev.disabled = (testPageState.activeQuestionNumber || 1) <= 1;
    }

    if (navNext) {
        navNext.onclick = () => {
            const current = testPageState.activeQuestionNumber || 1;
            const targetNum = Math.min(totalQuestions, current + 1);
            const target = findSectionByQuestion(targetNum);
            testPageState.activeQuestionNumber = targetNum;
            if (target.sectionIndex !== testPageState.sectionIndex) {
                testPageState.sectionIndex = target.sectionIndex;
                renderListeningTestUI();
            } else if (testPageState.__refreshListeningFooter) {
                testPageState.__refreshListeningFooter(true);
            }
        };
        navNext.disabled = (testPageState.activeQuestionNumber || 1) >= totalQuestions;
    }
}