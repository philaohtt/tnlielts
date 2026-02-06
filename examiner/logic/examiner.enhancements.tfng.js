// Ensure colorTfngAnswers is available globally for examiner HTML
if (typeof window !== 'undefined') {
    window.colorTfngAnswers = colorTfngAnswers;
}
// Polyfill escapeHtml if not defined (for examiner HTML context)
if (typeof escapeHtml !== 'function') {
    window.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };
}

// Ensure function is available globally for examiner HTML
if (typeof window !== 'undefined') {
    window.enhanceTfngWithCorrectAnswers = enhanceTfngWithCorrectAnswers;
}
// examiner.enhancements.tfng.js
// Enhancement functions for TFNG blocks in examiner view


function normTFNG(val) {
    if (val == null || val === '') return '—';
    const str = String(val).trim().toUpperCase();
    if (str === 'T' || str === 'TRUE' || str === 'YES') return 'TRUE';
    if (str === 'F' || str === 'FALSE' || str === 'NO') return 'FALSE';
    if (str === 'NG' || str === 'NOT GIVEN' || str === 'NOTGIVEN' || str === 'N') return 'NOT GIVEN';
    return '—';
}


function enhanceTfngWithCorrectAnswers(blockHtml, block, answers, answerKey) {
    const data = block.data || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const keyMap = answerKey || data.answerKey || data.correctAnswers || data.answers || {};
    const temp = document.createElement('div');
    temp.innerHTML = blockHtml;
    const rows = temp.querySelectorAll('.tfng-row');
    rows.forEach((row, qi) => {
        const q = questions[qi] || {};
        const qId = q.id || `q_${qi}`;
        const keyById = qId;
        const keyByNum = String(qi + 1);
        const rawCorrect = keyMap[keyById] ?? keyMap[keyByNum] ?? q.answer ?? '—';
        const correctAnswer = normTFNG(rawCorrect);
        // Add correct answer badge
        const badge = document.createElement('div');
        badge.style.marginLeft = '12px';
        badge.style.padding = '6px 10px';
        badge.style.background = '#eff6ff';
        badge.style.border = '1px solid #93c5fd';
        badge.style.borderRadius = '6px';
        badge.style.color = '#1d4ed8';
        badge.style.fontSize = '12px';
        badge.style.fontWeight = '600';
        badge.style.minWidth = '150px';
        badge.style.textAlign = 'right';
        badge.style.whiteSpace = 'nowrap';
        badge.innerHTML = `<span style="color:#64748b;">Correct:</span> <span style="color:#1d4ed8;">${escapeHtml(correctAnswer)}</span>`;
        row.appendChild(badge);
    });
    return temp.innerHTML;
}

function colorTfngAnswers(wrapper, block, answers) {
    const data = block.data || {};
    const questions = Array.isArray(data.questions) ? data.questions : [];
    const answerKey = data.answerKey || data.correctAnswers || data.answers || {};
    questions.forEach((q, qi) => {
        const qId = q.id || `q_${qi}`;
        const keyById = qId;
        const keyByNum = String(qi + 1);
        const key = `${block.id}:${qId}`;
        // Try all possible keys for candidate answer
        let candidateAnswer = answers.tfng?.[key];
        if (candidateAnswer === undefined) candidateAnswer = answers.tfng?.[qId];
        if (candidateAnswer === undefined) candidateAnswer = answers.tfng?.[keyByNum];
        candidateAnswer = normTFNG(candidateAnswer);
        const rawCorrect = answerKey[keyById] ?? answerKey[keyByNum] ?? q.answer ?? '—';
        const correctAnswer = normTFNG(rawCorrect);
        const isCorrect = candidateAnswer !== '—' && candidateAnswer === correctAnswer;
        const rows = wrapper.querySelectorAll('.tfng-row');
        if (rows[qi]) {
            const row = rows[qi];
            if (candidateAnswer !== '—') {
                const checkedInput = row.querySelector(`input[value="${candidateAnswer}"]:checked`);
                if (checkedInput) {
                    const label = checkedInput.closest('label');
                    if (label) {
                        // Reset styles first
                        label.style.background = '';
                        label.style.borderColor = '';
                        label.style.color = '';
                        label.style.textDecoration = '';
                        label.style.opacity = '';
                        let icon = label.querySelector('.answer-icon');
                        if (!icon) {
                            icon = document.createElement('span');
                            icon.className = 'answer-icon';
                            label.prepend(icon);
                        }
                        label.classList.remove('correct', 'incorrect');
                        icon.classList.remove('v', 'x');
                        if (isCorrect) {
                            // Correct: green background, green border, green text
                            label.style.background = '#dcfce7';
                            label.style.borderColor = '#16a34a';
                            label.style.color = '#16a34a';
                            icon.textContent = 'V';
                            icon.classList.add('v');
                            label.classList.add('correct');
                        } else {
                            // Incorrect: red background, red border, red text, strikethrough
                            label.style.background = '#fee2e2';
                            label.style.borderColor = '#dc2626';
                            label.style.color = '#dc2626';
                            label.style.textDecoration = 'line-through';
                            icon.textContent = 'X';
                            icon.classList.add('x');
                            label.classList.add('incorrect');
                        }
                    }
                }
            } else {
                const optionsGroup = row.querySelector('.tfng-options-group');
                if (optionsGroup) {
                    optionsGroup.querySelectorAll('label').forEach(label => {
                        // Not answered: faded
                        label.style.opacity = '0.5';
                        label.style.background = '';
                        label.style.borderColor = '';
                        label.style.color = '';
                        label.style.textDecoration = '';
                    });
                }
            }
        }
    });
}
