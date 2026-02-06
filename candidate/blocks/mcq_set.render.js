import { escapeHtml } from "../app/candidate.utils.js";

export function renderMcqSetBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instruction = data.instruction || data.instructions || '';
    const questions = Array.isArray(data.questions) ? data.questions : [];

    const qHtml = questions.map((q, qi) => {
        const qId = q.id || `q_${qi}`;
        const allowMultiple = !!q.allowMultiple;
        const saved = ctx.getMcqAnswer ? ctx.getMcqAnswer(block.id, qId) : null;
        const isMulti = allowMultiple === true;

        const opts = (q.options || []).map((opt, oi) => {
            const checked = isMulti
                ? (Array.isArray(saved) && saved.includes(oi))
                : (typeof saved === 'number' && saved === oi);

            const inputType = isMulti ? 'checkbox' : 'radio';
            const nameAttr = `mcq_${block.id}_${qId}`;

            return `
                <label style="display:flex; align-items:center; gap:8px; margin:6px 0;">
                    <input 
                        class="mcq-option-input" 
                        type="${inputType}" 
                        name="${escapeHtml(nameAttr)}" 
                        data-block-id="${escapeHtml(block.id || '')}"
                        data-qid="${escapeHtml(qId)}"
                        data-opt-idx="${oi}"
                        ${checked ? 'checked' : ''}
                        ${ro ? 'disabled' : ''}
                    />
                    <span>${String.fromCharCode(65 + oi)}. ${escapeHtml(opt || '')}</span>
                </label>
            `;
        }).join('');

        return `
            <div style="margin-bottom: 16px;">
                <div style="font-weight: 600; margin-bottom: 8px;"><span class="mcq-question-number">${qi + 1}</span>. ${escapeHtml(q.prompt || '')}</div>
                <div>${opts}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="mcq-block">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instruction ? `<div class="gap-instructions">${escapeHtml(instruction)}</div>` : ''}
            <div>${qHtml || '<div style="color:#999;">No questions found.</div>'}</div>
        </div>
    `;
}