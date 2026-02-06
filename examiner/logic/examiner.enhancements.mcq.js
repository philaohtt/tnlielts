// Parse MCQ correct answer(s) to indices (A,1,"A,C",[0,2], etc)
function parseMcqCorrect(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw.map(Number).filter(n => !isNaN(n));
    if (typeof raw === 'number') return [raw];
    if (typeof raw === 'string') {
        // Accept comma-separated letters or numbers
        return raw.split(',').map(s => {
            s = s.trim();
            if (/^[A-Za-z]$/.test(s)) return s.toUpperCase().charCodeAt(0) - 65;
            const n = Number(s);
            return isNaN(n) ? null : n;
        }).filter(n => n != null && !isNaN(n));
    }
    return [];
}

// Ensure colorMcqAnswers is available globally for examiner HTML
if (typeof window !== 'undefined') {
    function colorMcqAnswers(wrapper, block, answers) {
        // Find all MCQ question blocks in the wrapper
        const data = block.data || {};
        const questions = Array.isArray(data.questions) ? data.questions : [];
        const answerKey = data.answerKey || data.correctAnswers || data.answers || {};
            // Collect all MCQ inputs
            const allInputs = Array.from(wrapper.querySelectorAll('input[type="radio"],input[type="checkbox"]'));
            // Group inputs by question
            const groupMap = new Map();
            allInputs.forEach(input => {
                let key = input.name;
                if (!key) {
                    const qCont = input.closest('.mcq-question');
                    if (qCont) {
                        key = qCont;
                    } else {
                        // fallback: parent of .option
                        const opt = input.closest('.option');
                        key = opt ? opt.parentElement : input.parentElement;
                    }
                }
                if (!groupMap.has(key)) groupMap.set(key, []);
                groupMap.get(key).push(input);
            });

            // Iterate groups in DOM order
            const groups = Array.from(groupMap.values());
            groups.forEach((inputs, qi) => {
                const q = questions[qi] || {};
                const qId = q.id || `q_${qi}`;
                const raw = answerKey[qId] ?? answerKey[String(qi + 1)] ?? q.correctIndices ?? q.correctIndex ?? null;
                const correctIndices = parseMcqCorrect(raw);
                // For each option in this group
                inputs.forEach((input, optIdx) => {
                    const label = input.closest('label');
                    if (!label) return;
                    const isChecked = input.checked;
                    const isCorrect = correctIndices.includes(optIdx);
                    // Reset styles
                    label.style.background = '';
                    label.style.borderColor = '';
                    label.style.color = '';
                    label.style.textDecoration = '';
                    label.style.opacity = '';
                    label.style.fontWeight = '';
                    label.style.fontSize = '';
                    let icon = label.querySelector('.answer-icon');
                    if (!icon) {
                        icon = document.createElement('span');
                        icon.className = 'answer-icon';
                        label.prepend(icon);
                    }
                    label.classList.remove('correct', 'incorrect');
                    icon.classList.remove('v', 'x');
                    if (isChecked && isCorrect) {
                        label.style.background = '#dcfce7';
                        label.style.borderColor = '#16a34a';
                        label.style.color = '#16a34a';
                        label.style.textDecoration = '';
                        label.style.opacity = '1';
                        label.style.fontWeight = '600';
                        label.style.fontSize = '15px';
                        icon.textContent = 'V';
                        icon.classList.add('v');
                        label.classList.add('correct');
                    } else if (isChecked && !isCorrect) {
                        label.style.background = '#fee2e2';
                        label.style.borderColor = '#dc2626';
                        label.style.color = '#dc2626';
                        label.style.textDecoration = 'line-through';
                        label.style.opacity = '1';
                        label.style.fontWeight = '600';
                        label.style.fontSize = '15px';
                        icon.textContent = 'X';
                        icon.classList.add('x');
                        label.classList.add('incorrect');
                    } else if (!isChecked && isCorrect) {
                        label.style.background = '#eff6ff';
                        label.style.borderColor = '#1d4ed8';
                        label.style.color = '#1d4ed8';
                        label.style.textDecoration = '';
                        label.style.opacity = '1';
                        label.style.fontWeight = '600';
                        label.style.fontSize = '15px';
                        icon.textContent = '';
                    } else if (!isChecked && !isCorrect) {
                        label.style.background = '';
                        label.style.borderColor = '';
                        label.style.color = '';
                        label.style.textDecoration = '';
                        label.style.opacity = '0.5';
                        label.style.fontWeight = '';
                        label.style.fontSize = '';
                        icon.textContent = '';
                    }
                });
            });
        }
    // Attach globally
    window.colorMcqAnswers = colorMcqAnswers;
}
