// Ensure function is available globally for examiner HTML
if (typeof window !== 'undefined') {
    window.enhanceMatchingShowCandidateAndCorrect = enhanceMatchingShowCandidateAndCorrect;
}
// examiner.enhancements.matching.js
// Enhancement functions for Matching and Matching Visual blocks in examiner view

function enhanceMatchingVisualWithCorrectAnswers(blockHtml, block, answers, answerKey) {
    const data = block.data || {};
    const zones = Array.isArray(data.zones) ? data.zones : [];
    const options = Array.isArray(data.options) ? data.options : [];
    const blockId = block.id;
    // Get candidate answers
    let candMap = answers?.matching?.[blockId] || {};
    if (typeof candMap === 'string') {
        try { candMap = JSON.parse(candMap); } catch { candMap = {}; }
    }
    const temp = document.createElement('div');
    temp.innerHTML = blockHtml;
    const gapZones = zones.filter(z => z.kind !== 'text' && z.n);
    // Sort zones by number
    const orderedZones = gapZones.slice().sort((a, b) => {
        const an = Number(a.n) || 0;
        const bn = Number(b.n) || 0;
        return an - bn;
    });
    // Helper to normalize candidate answers (accepts optionId OR letter A/B/C)
    function getCandLetterAndText(rawVal) {
        if (rawVal == null) return { candLetter:'', candText:'', candOption:null };
        // If stored as a letter like "A"
        if (typeof rawVal === 'string' && /^[A-Za-z]$/.test(rawVal.trim())) {
            const letter = rawVal.trim().toUpperCase();
            const idx = letter.charCodeAt(0) - 65;
            const opt = options[idx] || null;
            return { candLetter: letter, candText: opt?.text || '', candOption: opt };
        }
        // If stored as an optionId
        const optId = String(rawVal);
        const opt = options.find(o => o.id === optId) || null;
        const idx = opt ? options.indexOf(opt) : -1;
        const letter = (idx >= 0) ? String.fromCharCode(65 + idx) : '';
        return { candLetter: letter, candText: opt?.text || '', candOption: opt };
    }
    // Color the zones, add numbering and icons
    orderedZones.forEach((zone) => {
        const zoneNum = zone.n;
        const zoneId = zone.id;
        const correctOptionId = zone.correctOptionId;
        // Find candidate answer
        const rawCand = candMap[zoneNum] ?? candMap[zoneId] ?? candMap[String(zoneNum)] ?? candMap[String(zoneId)];
        const { candLetter, candText } = getCandLetterAndText(rawCand);
        // Find correct answer
        const correctOption = options.find(o => o.id === correctOptionId);
        const correctLetter = correctOption ? String.fromCharCode(65 + options.indexOf(correctOption)) : '';

        const isCorrect = !!candLetter && !!correctLetter && candLetter === correctLetter;
        // Find the zone element in DOM
        const zoneEl =
            temp.querySelector(`.mc-zone--gap[data-zone-id="${zoneId}"]`) ||
            temp.querySelector(`.mc-zone--gap[data-zone-num="${zoneNum}"]`);
        if (!zoneEl) return;
        if (!candLetter) {
            // No answer placed, leave zone untouched
            return;
        }
        // Color the zone
        zoneEl.style.border = isCorrect ? '2px solid #16a34a' : '2px solid #dc2626';
        zoneEl.style.background = isCorrect ? 'rgba(220, 252, 231, 0.9)' : 'rgba(254, 226, 226, 0.9)';
        // Ensure zone provides usable width for horizontal text
        zoneEl.style.display = 'flex';
        zoneEl.style.alignItems = 'stretch';
        zoneEl.style.justifyContent = 'stretch';
        zoneEl.style.padding = '0';
        zoneEl.style.overflow = 'visible';        // let pill breathe
        // Restructure the content: number + text + icon
        const placedPill = zoneEl.querySelector('.mc-placed-pill');
        if (placedPill) {
            // Clear existing content
            placedPill.innerHTML = '';
            placedPill.style.width = '100%';
            placedPill.style.maxWidth = 'none';          // IMPORTANT: override CSS max-width:90%
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
            // Add zone number
            const numSpan = document.createElement('span');
            numSpan.className = 'zone-number-display';
            numSpan.textContent = String(zoneNum);
            numSpan.style.fontWeight = '700';
            numSpan.style.fontSize = '14px';
            numSpan.style.minWidth = '24px';
            numSpan.style.flexShrink = '0';
            numSpan.style.color = isCorrect ? '#16a34a' : '#dc2626';
            placedPill.appendChild(numSpan);
            // Add answer text
            const textSpan = document.createElement('span');
            textSpan.textContent = candText;
            textSpan.style.flex = '1';
            textSpan.style.minWidth = '0';
            textSpan.style.maxWidth = '100%';
            textSpan.style.color = isCorrect ? '#16a34a' : '#dc2626';
            textSpan.style.fontWeight = '600';
            textSpan.style.fontSize = '13px';
            textSpan.title = candText || '';
            // Prevent vertical letter stacking; wrap by words only
            textSpan.style.whiteSpace = 'normal';
            textSpan.style.wordBreak = 'normal';
            textSpan.style.overflowWrap = 'anywhere'; // breaks long words if needed
            textSpan.style.lineHeight = '1.2';
            placedPill.appendChild(textSpan);
            // Add V/X icon
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
    // Make options panel collapsible (button should live on layout, not inside bank)
    const layout = temp.querySelector('.mc-layout');
    const bankSide = temp.querySelector('.mc-bank-side');
    if (layout && bankSide) {
        layout.style.position = 'relative';
        const toggleBtn = document.createElement('button');
        toggleBtn.textContent = '\u25c0';
        toggleBtn.type = 'button';
        toggleBtn.style.cssText =
            'position:absolute; right:280px; top:50%; transform:translateY(-50%);' +
            'background:#fff; border:1px solid #d1d5db; padding:8px 6px;' +
            'cursor:pointer; border-radius:6px 0 0 6px; font-size:16px; z-index:9999;';
        let isCollapsed = false;
        toggleBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            isCollapsed = !isCollapsed;
            const bankCard = bankSide.querySelector('.mc-card');
            if (isCollapsed) {
                if (bankCard) bankCard.style.display = 'none';
                bankSide.style.flex = '0 0 0px';
                bankSide.style.width = '0px';
                bankSide.style.padding = '0';
                bankSide.style.margin = '0';
                bankSide.style.overflow = 'hidden';
                toggleBtn.textContent = '\u25b6';
                toggleBtn.style.right = '0px';
            } else {
                if (bankCard) bankCard.style.display = 'block';
                bankSide.style.flex = '';
                bankSide.style.width = '';
                bankSide.style.padding = '';
                bankSide.style.margin = '';
                bankSide.style.overflow = '';
                toggleBtn.textContent = '\u25c0';
                toggleBtn.style.right = '280px';
            }
        };
        layout.appendChild(toggleBtn);
    }
    // Create answer key panel
    const answersArea = document.createElement('div');
    answersArea.style.display = 'flex';
    answersArea.style.flexDirection = 'column';
    answersArea.style.gap = '8px';
    answersArea.style.minWidth = '240px';
    orderedZones.forEach((zone) => {
        const zoneNum = zone.n;
        const correctOptionId = zone.correctOptionId;
        const correctOption = options.find(o => o.id === correctOptionId);
        const correctLetter = correctOption ? String.fromCharCode(65 + options.indexOf(correctOption)) : '—';
        const correctText = correctOption?.text || '—';
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '8px';
        item.style.padding = '6px 10px';
        item.style.border = '1px solid #e2e8f0';
        item.style.borderRadius = '6px';
        item.style.background = '#f8fafc';
        item.style.fontSize = '13px';
        const num = document.createElement('span');
        num.textContent = String(zoneNum);
        num.style.fontWeight = '600';
        num.style.color = '#0f172a';
        num.style.minWidth = '20px';
        const ans = document.createElement('span');
        ans.innerHTML = `<span style=\"color:#1d4ed8; font-weight:600;\">${correctLetter}</span> — ${escapeHtml(correctText)}`;
        ans.style.flex = '1';
        item.appendChild(num);
        item.appendChild(ans);
        answersArea.appendChild(item);
    });
    // Wrap visual and answer key side by side
    const visualBlock = temp.querySelector('.matching-canvas-task');
    if (visualBlock && answersArea.children.length > 0) {
        const wrapper = document.createElement('div');
        wrapper.style.display = 'flex';
        wrapper.style.gap = '16px';
        wrapper.style.alignItems = 'flex-start';
        visualBlock.parentNode.insertBefore(wrapper, visualBlock);
        wrapper.appendChild(visualBlock);
        wrapper.appendChild(answersArea);
    }
    return temp.innerHTML;
}

function enhanceMatchingShowCandidateAndCorrect(blockEl, block, skillAnswers) {
    const blockId = block.id;
    const options = block.data?.options || [];
    const itemsData = Array.isArray(block.data?.items) ? block.data.items : [];
    const correctMap = block.data?.answerKey || block.data?.correctAnswers || {};
    let candMap = skillAnswers?.matching?.[blockId] || {};
    if (typeof candMap === 'string') {
        try { candMap = JSON.parse(candMap); } catch { candMap = {}; }
    }

    const items = blockEl.querySelectorAll('.matching-item[data-item-num]');
    items.forEach((el) => {
        const itemNum = el.dataset.itemNum;
        if (!itemNum) return;

        const itemIndex = Math.max(0, Number(itemNum) - 1);
        const itemData = itemsData[itemIndex] || null;
        const itemId = itemData?.id || itemData?.itemId || itemData?.slotId || '';

        const candLetter = String(candMap[itemNum] || candMap[itemId] || '').trim().toUpperCase();
        const correctLetter = String(
            correctMap[itemNum] ?? correctMap[itemId] ?? correctMap[String(itemNum)] ?? itemData?.key ?? ''
        ).trim().toUpperCase();
        const isCorrect = !!candLetter && !!correctLetter && candLetter === correctLetter;

        if (!candLetter) return;

        const candIdx = candLetter ? candLetter.charCodeAt(0) - 65 : -1;
        const candText = candIdx >= 0 && candIdx < options.length ? options[candIdx]?.text || '' : '';
        const correctIdx = correctLetter ? correctLetter.charCodeAt(0) - 65 : -1;
        const correctText = correctIdx >= 0 && correctIdx < options.length ? options[correctIdx]?.text || '' : '';

        const selectedArea = el.querySelector('.matching-selected-area');
        if (!selectedArea) return;
        selectedArea.style.display = 'flex';
        selectedArea.style.alignItems = 'center';
        selectedArea.style.gap = '8px';

        // Add V/X icon before the candidate answer
        let icon = selectedArea.querySelector('.answer-icon');
        if (!icon) {
            icon = document.createElement('span');
            icon.className = 'answer-icon';
            icon.style.fontWeight = '700';
            icon.style.marginRight = '6px';
            selectedArea.prepend(icon);
        }
        icon.textContent = isCorrect ? 'V' : 'X';
        icon.style.color = isCorrect ? '#16a34a' : '#dc2626';

        // Apply green/red styling to the item container
        el.style.border = isCorrect ? '2px solid #16a34a' : '2px solid #dc2626';
        el.style.background = isCorrect ? '#dcfce7' : '#fee2e2';

        selectedArea.style.borderColor = isCorrect ? '#16a34a' : '#dc2626';
        selectedArea.style.background = isCorrect ? '#dcfce7' : '#fee2e2';
        selectedArea.style.color = isCorrect ? '#16a34a' : '#dc2626';

        const matchText = selectedArea.querySelector('.matching-match-text');
        if (matchText) {
            matchText.style.flex = '1';
            matchText.style.width = '50%';
        }

        if (!isCorrect && correctLetter) {
            const correctLine = correctText ? `${correctLetter} — ${correctText}` : `${correctLetter}`;
            let correctBadge = selectedArea.querySelector('.correct-badge');
            if (!correctBadge) {
                correctBadge = document.createElement('span');
                correctBadge.className = 'correct-badge';
                correctBadge.style.fontSize = '12px';
                correctBadge.style.fontWeight = '600';
                correctBadge.style.color = '#1d4ed8';
                correctBadge.style.flex = '1';
                correctBadge.style.width = '50%';
                correctBadge.style.textAlign = 'right';
                correctBadge.style.pointerEvents = 'none';
                selectedArea.appendChild(correctBadge);
            }
            correctBadge.textContent = `Correct: ${correctLine}`;
        }
    });
}
