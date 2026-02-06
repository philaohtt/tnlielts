// examiner.enhancements.matchingvisual.js
// Enhancement functions for Matching Visual blocks in examiner view

const _escapeHtml = (typeof escapeHtml === 'function') ? escapeHtml : (window && typeof window.escapeHtml === 'function' ? window.escapeHtml : (x => x));

function enhanceMatchingVisualWithCorrectAnswers(blockHtml, block, answers) {
    const data = block.data || {};
    const zones = Array.isArray(data.zones) ? data.zones : [];
    const options = Array.isArray(data.options) ? data.options : [];
    const blockId = block.id;
    let candMap = answers?.matching?.[blockId] || {};
    if (typeof candMap === 'string') {
        try { candMap = JSON.parse(candMap); } catch { candMap = {}; }
    }
    const temp = document.createElement('div');
    temp.innerHTML = blockHtml;
    const gapZones = zones.filter(z => z.kind !== 'text' && z.n);
    const orderedZones = gapZones.slice().sort((a, b) => {
        const an = Number(a.n) || 0;
        const bn = Number(b.n) || 0;
        return an - bn;
    });
    function getCandLetterAndText(rawVal) {
        if (rawVal == null) return { candLetter:'', candText:'', candOption:null };
        if (typeof rawVal === 'string' && /^[A-Za-z]$/.test(rawVal.trim())) {
            const letter = rawVal.trim().toUpperCase();
            const idx = letter.charCodeAt(0) - 65;
            const opt = options[idx] || null;
            return { candLetter: letter, candText: opt?.text || '', candOption: opt };
        }
        const optId = String(rawVal);
        const opt = options.find(o => o.id === optId) || null;
        const idx = opt ? options.indexOf(opt) : -1;
        const letter = (idx >= 0) ? String.fromCharCode(65 + idx) : '';
        return { candLetter: letter, candText: opt?.text || '', candOption: opt };
    }
    orderedZones.forEach((zone) => {
        const zoneNum = zone.n;
        const zoneId = zone.id;
        const correctOptionId = zone.correctOptionId;
        const rawCand = candMap[zoneNum] ?? candMap[zoneId] ?? candMap[String(zoneNum)] ?? candMap[String(zoneId)];
        const { candLetter, candText } = getCandLetterAndText(rawCand);
        const correctOption = options.find(o => o.id === correctOptionId);
        const correctLetter = correctOption ? String.fromCharCode(65 + options.indexOf(correctOption)) : '';
        const isCorrect = !!candLetter && !!correctLetter && candLetter === correctLetter;
        const zoneEl =
            temp.querySelector(`.mc-zone--gap[data-zone-id="${zoneId}"]`) ||
            temp.querySelector(`.mc-zone--gap[data-zone-num="${zoneNum}"]`);
        if (!zoneEl) return;
        if (!candLetter) {
            return;
        }
        zoneEl.style.border = isCorrect ? '2px solid #16a34a' : '2px solid #dc2626';
        zoneEl.style.background = isCorrect ? 'rgba(220, 252, 231, 0.9)' : 'rgba(254, 226, 226, 0.9)';
        zoneEl.style.display = 'flex';
        zoneEl.style.alignItems = 'stretch';
        zoneEl.style.justifyContent = 'stretch';
        zoneEl.style.padding = '0';
        zoneEl.style.overflow = 'visible';
        const placedPill = zoneEl.querySelector('.mc-placed-pill');
        if (placedPill) {
            placedPill.innerHTML = '';
            placedPill.style.width = '100%';
            placedPill.style.maxWidth = 'none';
            placedPill.style.height = '100%';
            placedPill.style.minHeight = 'unset';
            placedPill.style.display = 'flex';
            placedPill.style.flexDirection = 'row';
            placedPill.style.alignItems = 'center';
            placedPill.style.justifyContent = 'space-between';
            placedPill.style.gap = '8px';
            placedPill.style.padding = '6px 8px';
            placedPill.style.boxSizing = 'border-box';
            placedPill.style.overflow = 'hidden';
                const numSpan = document.createElement('span');
                numSpan.className = 'zone-number-display';
                numSpan.textContent = String(zoneNum);
                numSpan.style.fontWeight = '700';
                numSpan.style.fontSize = '14px';
                numSpan.style.minWidth = '24px';
                numSpan.style.flexShrink = '0';
                numSpan.style.color = isCorrect ? '#16a34a' : '#dc2626';
                placedPill.appendChild(numSpan);
                const icon = document.createElement('span');
                icon.className = 'answer-icon';
                icon.textContent = isCorrect ? 'V' : 'X';
                icon.style.fontWeight = '700';
                icon.style.fontSize = '16px';
                icon.style.color = isCorrect ? '#16a34a' : '#dc2626';
                icon.style.flexShrink = '0';
                placedPill.appendChild(icon);
        }
    });
    return temp.innerHTML;
}

window.enhanceMatchingVisualWithCorrectAnswers = enhanceMatchingVisualWithCorrectAnswers;

    // Render answer area below matching visual block
    function renderMatchingVisualAnswerArea(block, answers) {
        const blockId = block.id;
        const data = block.data || {};
        const options = Array.isArray(data.options) ? data.options : [];
        let candMap = answers?.matching?.[blockId] || {};

        // Use only gap zones, sorted by zone.n ascending
        const zones = (Array.isArray(data.zones) ? data.zones : [])
            .filter(z => z.kind !== 'text' && z.n)
            .sort((a, b) => Number(a.n) - Number(b.n));

        // Helper: get letter and text for candidate value (same as enhancer)
        function getCandLetterAndText(rawVal) {
            if (rawVal == null) return { candLetter:'', candText:'', candOption:null };
            if (typeof rawVal === 'string' && /^[A-Za-z]$/.test(rawVal.trim())) {
                const letter = rawVal.trim().toUpperCase();
                const idx = letter.charCodeAt(0) - 65;
                const opt = options[idx] || null;
                return { candLetter: letter, candText: opt?.text || '', candOption: opt };
            }
            const optId = String(rawVal);
            const opt = options.find(o => o.id === optId) || null;
            const idx = opt ? options.indexOf(opt) : -1;
            const letter = (idx >= 0) ? String.fromCharCode(65 + idx) : '';
            return { candLetter: letter, candText: opt?.text || '', candOption: opt };
        }

        // Helper: get letter and text for correct option
        function getCorrectLetterAndText(optionId) {
            const idx = options.findIndex(opt => opt.id === optionId);
            if (idx < 0) return { letter: '', text: '' };
            const letter = String.fromCharCode(65 + idx);
            const text = options[idx]?.text || '';
            return { letter, text };
        }

        let rowsHtml = '';
        zones.forEach((zone) => {
            const zoneNum = zone.n;
            const zoneId = zone.id;
            // Candidate answer (same fallback as enhancer)
            const rawCand = candMap[zoneNum] ?? candMap[zoneId] ?? candMap[String(zoneNum)] ?? candMap[String(zoneId)];
            const cand = getCandLetterAndText(rawCand);
            // Correct answer
            const correctOptionId = zone.correctOptionId;
            const correct = getCorrectLetterAndText(correctOptionId);
            // Row color and icon
            let rowClass = 'mv-answer-row';
            let icon = '';
            if (!cand.candLetter) {
                rowClass += ' mv-row-blank';
            } else if (cand.candLetter === correct.letter) {
                rowClass += ' mv-row-correct';
                icon = '<span class="answer-icon" style="color:#16a34a;font-weight:700;font-size:16px;">V</span>';
            } else {
                rowClass += ' mv-row-wrong';
                icon = '<span class="answer-icon" style="color:#dc2626;font-weight:700;font-size:16px;">X</span>';
            }
            // Candidate cell: only show if not correct
            let candCell = '';
            if (!cand.candLetter) {
                candCell = `<div class="mv-pill mv-pill-blank"></div>`;
            } else if (cand.candLetter !== correct.letter) {
                candCell = `<div class="mv-pill mv-pill-wrong">${icon} ${cand.candLetter}: ${cand.candText}</div>`;
            }
            // If correct, show V icon in correct cell only
            let correctCell = `<div class="mv-pill mv-pill-correct">${correct.letter}${correct.letter ? ': ' : ''}${correct.text}</div>`;
            if (cand.candLetter === correct.letter) {
                correctCell = `<div class="mv-pill mv-pill-correct">${icon} ${correct.letter}: ${correct.text}</div>`;
            }
            rowsHtml += `<div class="${rowClass}">
                <div class="mv-pill">${zoneNum}</div>
                ${candCell}
                ${correctCell}
            </div>`;
        });
        return `<div class="mv-answer-area">
            <div class="mv-answer-title">Answer Area</div>
            <div class="mv-answer-list">
                ${rowsHtml}
            </div>
        </div>`;
    }

    window.renderMatchingVisualAnswerArea = renderMatchingVisualAnswerArea;
