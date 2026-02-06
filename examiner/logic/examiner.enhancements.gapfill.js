// Ensure function is available globally for examiner HTML
if (typeof window !== 'undefined') {
    window.enhanceGapFillWithCorrectAnswers = enhanceGapFillWithCorrectAnswers;
}
// examiner.enhancements.gapfill.js
// Enhancement functions for Gap Fill and Gap Fill Visual blocks in examiner view


// Use escapeHtml from import or window
const _escapeHtml = (typeof escapeHtml === 'function') ? escapeHtml : (window && typeof window.escapeHtml === 'function' ? window.escapeHtml : (x => x));

function buildGapAnswerMap(data) {
    const answerKey = data.answerKey || data.correctAnswers || data.answers || {};
    const map = { ...answerKey };
    if (Array.isArray(data.gaps)) {
        data.gaps.forEach(g => {
            if (!g || !g.id) return;
            if (Array.isArray(g.answers) && g.answers.length > 0) {
                map[g.id] = g.answers;
            }
        });
    }
    return map;
}

function enhanceGapFillWithCorrectAnswers(blockHtml, block, answers) {
    const data = block.data || {};
    const blockType = block.type ? block.type.toLowerCase() : '';
    const answerMap = buildGapAnswerMap(data);
    const gapfillAnswers = answers?.gap || {};

    // For gap_fill_visual, color inputs and show correct answers below the map
    if (blockType === 'gap_fill_visual') {
        const temp = document.createElement('div');
        temp.innerHTML = blockHtml;

        const gaps = Array.isArray(data.gaps) ? data.gaps : [];
        const orderedGaps = gaps.slice().sort((a, b) => {
            const ay = Number.isFinite(Number(a?.y)) ? Number(a.y) : Number.POSITIVE_INFINITY;
            const by = Number.isFinite(Number(b?.y)) ? Number(b.y) : Number.POSITIVE_INFINITY;
            if (ay !== by) return ay - by;
            const ax = Number.isFinite(Number(a?.x)) ? Number(a.x) : Number.POSITIVE_INFINITY;
            const bx = Number.isFinite(Number(b?.x)) ? Number(b.x) : Number.POSITIVE_INFINITY;
            return ax - bx;
        });

        // Color candidate answers and force numbering visible
        temp.querySelectorAll('.map-input').forEach((input) => {
            const gapId = input.getAttribute('data-gap-id');
            if (!gapId) return;

            const rawCorrect = answerMap[gapId];
            const candidateAnswer = String(gapfillAnswers[gapId] || '');

            let correctAnswers = [];
            if (Array.isArray(rawCorrect) && rawCorrect.length > 0) {
                correctAnswers = rawCorrect;
            } else if (typeof rawCorrect === 'string' && rawCorrect.trim()) {
                correctAnswers = [rawCorrect];
            }

            const normalized = candidateAnswer.trim().toLowerCase();
            const isCorrect = correctAnswers.some(ans => ans.toLowerCase().trim() === normalized);

            const box = input.closest('.map-gap-box');
            const numberEl = box?.querySelector('.gap-number');
            if (numberEl) {
                numberEl.style.display = 'inline-block';
                numberEl.style.opacity = '1';
            }

            if (candidateAnswer.trim()) {
                // Candidate provided an answer; color and enhance as needed (handled below)
            }
        });

        // Group gaps by visual row (y position) to place correct answers below
        const rowTolerance = 0.02;
        const rows = [];
        orderedGaps.forEach((gap) => {
            const gapY = Number.isFinite(Number(gap?.y)) ? Number(gap.y) : 0;
            let row = rows.find(r => Math.abs(r.y - gapY) <= rowTolerance);
            if (!row) {
                row = { y: gapY, items: [] };
                rows.push(row);
            }
            row.items.push(gap);
        });

        const answersArea = document.createElement('div');
        answersArea.style.marginTop = '12px';
        answersArea.style.display = 'flex';
        answersArea.style.flexDirection = 'column';
        answersArea.style.gap = '6px';

        rows.forEach((row, rowIdx) => {
            const rowDiv = document.createElement('div');
            rowDiv.style.display = 'flex';
            rowDiv.style.flexWrap = 'wrap';
            rowDiv.style.gap = '12px';
            rowDiv.style.alignItems = 'center';

            row.items.forEach((gap, idx) => {
                const gapNumber = Number.isFinite(Number(gap?.n)) ? Number(gap.n) : (rowIdx + 1 + idx);
                const rawCorrect = answerMap[gap.id];
                let correctText = '—';
                if (Array.isArray(rawCorrect) && rawCorrect.length > 0) {
                    correctText = rawCorrect.join(' / ');
                } else if (typeof rawCorrect === 'string' && rawCorrect.trim()) {
                    correctText = rawCorrect;
                }

                const item = document.createElement('div');
                item.style.display = 'flex';
                item.style.alignItems = 'center';
                item.style.gap = '6px';
                item.style.padding = '4px 8px';
                item.style.border = '1px solid #e2e8f0';
                item.style.borderRadius = '6px';
                item.style.background = '#f8fafc';

                const num = document.createElement('span');
                num.textContent = String(gapNumber);
                num.style.fontWeight = '600';
                num.style.color = '#0f172a';

                const ans = document.createElement('span');
                ans.textContent = correctText;
                ans.style.color = '#1d4ed8';

                item.appendChild(num);
                item.appendChild(ans);
                rowDiv.appendChild(item);
            });

            answersArea.appendChild(rowDiv);
        });

        const visualBlock = temp.querySelector('.gap-visual-block');
        if (visualBlock) {
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.gap = '16px';
            wrapper.style.alignItems = 'flex-start';

            visualBlock.parentNode.insertBefore(wrapper, visualBlock);
            wrapper.appendChild(visualBlock);

            answersArea.style.marginTop = '0';
            answersArea.style.minWidth = '220px';
            wrapper.appendChild(answersArea);
        } else {
            temp.appendChild(answersArea);
        }

        return temp.innerHTML;
    }

    // For regular gap_fill, color inputs green/red
    const gapfillAnswers_flat = gapfillAnswers;
    console.log('[GAP_FILL] enhancement start', {
        blockId: block.id,
        gapfillAnswers: gapfillAnswers_flat
    });

    const temp = document.createElement('div');
    temp.innerHTML = blockHtml;

    const inputs = temp.querySelectorAll('.gap-input, .cbt-gap-input');
    console.log(`[GAP_FILL] found ${inputs.length} input fields`);

    inputs.forEach((input, idx) => {
        const gapId = input.getAttribute('data-gap-id');
        if (!gapId) {
            console.log(`[GAP_FILL] input ${idx} has no data-gap-id`);
            return;
        }

        const rawCorrect = answerMap[gapId];
        const candidateAnswer = String(gapfillAnswers_flat[gapId] || '');

        // Normalize correct answers to array
        let correctAnswers = [];
        if (Array.isArray(rawCorrect) && rawCorrect.length > 0) {
            correctAnswers = rawCorrect;
        } else if (typeof rawCorrect === 'string' && rawCorrect.trim()) {
            correctAnswers = [rawCorrect];
        }

        const normalized = candidateAnswer.trim().toLowerCase();
        const isCorrect = correctAnswers.some(ans => ans.toLowerCase().trim() === normalized);

        console.log(`[GAP_FILL] gap ${gapId}`, {
            candidateAnswer,
            correctAnswers,
            isCorrect
        });

        // Create an inline-flex container to keep inline alignment
        const container = document.createElement('span');
        container.style.display = 'inline-flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'space-between';
        container.style.verticalAlign = 'middle';
        container.style.lineHeight = '1';
        container.style.gap = '0';
        container.style.borderRadius = '6px';
        container.style.overflow = 'hidden';

        input.parentNode.insertBefore(container, input);
        container.appendChild(input);
        input.style.flex = '1';
        input.style.borderRadius = '6px 0 0 6px';
        input.style.margin = '0';
        input.style.verticalAlign = 'middle';
        input.style.lineHeight = '1.2';

        if (isCorrect && candidateAnswer.trim()) {
            // Green: correct answer
            container.style.background = '#dcfce7';
            input.style.background = '#dcfce7';
            input.style.color = '#16a34a';
            input.style.borderColor = '#16a34a';

            if (!container.querySelector('.answer-icon')) {
                const checkIcon = document.createElement('span');
                checkIcon.className = 'answer-icon';
                checkIcon.style.padding = '0 8px 0 6px';
                checkIcon.style.color = '#16a34a';
                checkIcon.style.fontSize = '16px';
                checkIcon.style.fontWeight = 'bold';
                checkIcon.textContent = 'V';
                container.insertBefore(checkIcon, input);
            }

            // Show alternatives if more than one
            if (correctAnswers.length > 1) {
                const alternatives = correctAnswers.slice(1).join('/');
                const altSpan = document.createElement('span');
                altSpan.style.padding = '6px 12px';
                altSpan.style.color = '#1d4ed8';
                altSpan.style.fontSize = '13px';
                altSpan.style.fontWeight = '500';
                altSpan.style.whiteSpace = 'nowrap';
                altSpan.style.background = '#dcfce7';
                altSpan.textContent = `/${alternatives}`;
                container.appendChild(altSpan);
            }
        } else if (candidateAnswer.trim()) {
            // Red with strikethrough: wrong answer + show correct
            input.style.textDecoration = 'line-through';

            // Add X icon before input
            if (!container.querySelector('.answer-icon')) {
                const xIcon = document.createElement('span');
                xIcon.className = 'answer-icon';
                xIcon.style.padding = '0 8px 0 6px';
                xIcon.style.color = '#dc2626';
                xIcon.style.fontSize = '16px';
                xIcon.style.fontWeight = 'bold';
                xIcon.textContent = 'X';
                container.insertBefore(xIcon, input);
            }

            // Show correct answer in blue
            if (correctAnswers.length > 0) {
                const correctSpan = document.createElement('span');
                correctSpan.style.padding = '6px 12px';
                correctSpan.style.color = '#1d4ed8';
                correctSpan.style.fontSize = '13px';
                correctSpan.style.fontWeight = '500';
                correctSpan.style.whiteSpace = 'nowrap';
                correctSpan.style.background = '#fee2e2';
                correctSpan.textContent = correctAnswers.join('/');
                container.appendChild(correctSpan);
            }
        } else {
            // No answer provided
            input.style.opacity = '0.5';
        }
    });

    return temp.innerHTML;
}
