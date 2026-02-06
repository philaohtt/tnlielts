import { escapeHtml } from "../app/candidate.utils.js";

export function renderGapFillBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instructions = data.instructions || '';
    const rawHtml = data.passageHtml || '';

    const temp = document.createElement('div');
    temp.innerHTML = rawHtml;

    let seq = 0;
    temp.querySelectorAll('.gap-marker').forEach(marker => {
        const gapId = marker.dataset.id || `gap_${seq}`;
        const qNum = marker.dataset.index || String(++seq);
        const savedValue = ctx.getAnswer(gapId) || '';

        const wrap = document.createElement('span');
        wrap.className = 'gap-input-wrap';
        wrap.innerHTML = `
            <span class="gap-num" data-for-gap="${escapeHtml(gapId)}" style="${savedValue ? 'display: none;' : ''}">${escapeHtml(qNum)}</span>
            <input class="gap-input" data-gap-id="${escapeHtml(gapId)}" data-qnum="${escapeHtml(qNum)}" value="${escapeHtml(savedValue)}" ${ro ? 'disabled readonly' : ''} />
        `;
        marker.replaceWith(wrap);
    });

    return `
        <div class="gap-block">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instructions ? `<div class="gap-instructions">${escapeHtml(instructions)}</div>` : ''}
            <div class="gap-passage">${temp.innerHTML}</div>
        </div>
    `;
}