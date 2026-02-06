import { escapeHtml } from "../app/candidate.utils.js";

// filepath: c:\Users\GA\OneDrive\Teach and Learn\Admin\IELTS app html\candidate\blocks\tfng.render.js

export function renderTfngBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instructions = data.instructions || '';
    const mode = data.mode || 'TFNG';
    const questions = Array.isArray(data.questions) ? data.questions : [];
    
    const modeOptions = mode === 'YNNG' 
        ? ['YES', 'NO', 'NOT GIVEN']
        : ['TRUE', 'FALSE', 'NOT GIVEN'];

    const qHtml = questions.map((q, qi) => {
        const qId = q.id || `q_${qi}`;
        const saved = ctx.getTfngAnswer ? ctx.getTfngAnswer(block.id, qId) : null;
        const nameAttr = `tfng_${block.id}_${qId}`;

        const opts = modeOptions.map((option) => {
            const checked = saved === option;

            return `
                <label class="tfng-option-label">
                    <input 
                        class="tfng-option-input" 
                        type="radio" 
                        name="${escapeHtml(nameAttr)}" 
                        value="${escapeHtml(option)}"
                        data-block-id="${escapeHtml(block.id || '')}"
                        data-qid="${escapeHtml(qId)}"
                        ${checked ? 'checked' : ''}
                        ${ro ? 'disabled' : ''}
                    />
                    <span class="tfng-option-text">${escapeHtml(option)}</span>
                </label>
            `;
        }).join('');

        return `
            <div class="tfng-row">
                <div class="tfng-statement">
                    <span class="tfng-q-num">${qi + 1}</span> ${escapeHtml(q.statement || '')}
                </div>
                <div class="tfng-options-group">
                    ${opts}
                </div>
            </div>
        `;
    }).join('');

    return `
        <div class="tfng-block" data-block-id="${escapeHtml(block.id || '')}">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instructions ? `<div class="gap-instructions">${escapeHtml(instructions)}</div>` : ''}
            <div class="tfng-list">
                ${qHtml || '<div style="color:#999;">No questions found.</div>'}
            </div>
        </div>
    `;
}