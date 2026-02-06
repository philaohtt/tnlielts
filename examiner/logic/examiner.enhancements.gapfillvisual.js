// examiner.enhancements.gapfillvisual.js
// Enhancement functions for Gap Fill Visual blocks in examiner view

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

function enhanceGapFillVisualWithCorrectAnswers(blockHtml, block, answers) {
    const data = block.data || {};
    const answerMap = buildGapAnswerMap(data);
    const gapfillAnswers = answers?.gap || {};
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
            if (isCorrect) {
                input.style.background = '#dcfce7';
                input.style.borderColor = '#16a34a';
                input.style.color = '#16a34a';
                if (numberEl) numberEl.style.color = '#16a34a';
            } else {
                input.style.background = '#fee2e2';
                input.style.borderColor = '#dc2626';
                input.style.color = '#dc2626';
                if (numberEl) numberEl.style.color = '#dc2626';
            }
            if (box && !box.querySelector('.answer-icon')) {
                const icon = document.createElement('span');
                icon.className = 'answer-icon';
                icon.textContent = isCorrect ? 'V' : 'X';
                icon.style.position = 'absolute';
                icon.style.right = '6px';
                icon.style.top = '50%';
                icon.style.transform = 'translateY(-50%)';
                icon.style.fontWeight = '700';
                icon.style.color = isCorrect ? '#16a34a' : '#dc2626';
                box.appendChild(icon);
            }
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

// Export for global use
window.enhanceGapFillVisualWithCorrectAnswers = enhanceGapFillVisualWithCorrectAnswers;
