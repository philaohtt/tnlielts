// examiner.enhancements.matchingheadings.js
// Enhancement functions for Matching Headings blocks in examiner view

const _escapeHtml = (typeof escapeHtml === 'function') ? escapeHtml : (window && typeof window.escapeHtml === 'function' ? window.escapeHtml : (x => x));

function enhanceMatchingHeadingsWithCorrectAnswers(blockHtml, block, answers) {
    const data = block.data || {};
    const options = Array.isArray(data.options) ? data.options : [];
    const slots = Array.isArray(data.slots) ? data.slots : [];
    const blockId = block.id;
    let candMap = answers?.matching?.[blockId] || {};
    if (typeof candMap === 'string') {
        try { candMap = JSON.parse(candMap); } catch { candMap = {}; }
    }
    const answerKey = data.answerKey || data.correctAnswers || {};
    const temp = document.createElement('div');
    temp.innerHTML = blockHtml;
    slots.forEach((slot, idx) => {
        const slotId = slot.id || slot.slotId || slot.qid || idx;
        const candLetter = String(candMap[slotId] || '').trim().toUpperCase();
        const correctLetter = String(answerKey[slotId] || '').trim().toUpperCase();
        const isCorrect = !!candLetter && !!correctLetter && candLetter === correctLetter;
        const slotEl = temp.querySelector(`[data-slot-id="${_escapeHtml(slotId)}"]`);
        if (!slotEl) return;
        slotEl.style.border = isCorrect ? '2px solid #16a34a' : '2px solid #dc2626';
        slotEl.style.background = isCorrect ? '#dcfce7' : '#fee2e2';
        let icon = slotEl.querySelector('.answer-icon');
        if (!icon) {
            icon = document.createElement('span');
            icon.className = 'answer-icon';
            icon.style.fontWeight = '700';
            icon.style.marginRight = '6px';
            slotEl.prepend(icon);
        }
        icon.textContent = isCorrect ? 'V' : 'X';
        icon.style.color = isCorrect ? '#16a34a' : '#dc2626';
        if (!isCorrect && correctLetter) {
            let correctBadge = slotEl.querySelector('.correct-badge');
            if (!correctBadge) {
                correctBadge = document.createElement('span');
                correctBadge.className = 'correct-badge';
                correctBadge.style.fontSize = '12px';
                correctBadge.style.fontWeight = '600';
                correctBadge.style.color = '#1d4ed8';
                correctBadge.style.flex = '1';
                correctBadge.style.textAlign = 'right';
                correctBadge.style.pointerEvents = 'none';
                slotEl.appendChild(correctBadge);
            }
            correctBadge.textContent = `Correct: ${correctLetter}`;
        }
    });
    return temp.innerHTML;
}

window.enhanceMatchingHeadingsWithCorrectAnswers = enhanceMatchingHeadingsWithCorrectAnswers;
