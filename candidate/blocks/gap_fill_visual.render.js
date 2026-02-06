import { escapeHtml } from "../app/candidate.utils.js";

// filepath: c:\Users\GA\OneDrive\Teach and Learn\Admin\IELTS app html\candidate\blocks\gap_fill_visual.render.js

export function renderGapFillVisualBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instructions = data.instructions || '';
    const image = data.image || {};
    const gaps = Array.isArray(data.gaps) ? data.gaps : [];
    const texts = Array.isArray(data.texts) ? data.texts : [];

    if (!image.dataUrl) {
        return `
            <div class="gap-visual-block">
                <div class="cbt-instruction-box">
                    Map image missing. Please contact administrator.
                </div>
            </div>
        `;
    }

    const orderedGaps = gaps.slice().sort((a, b) => {
        const an = Number.isFinite(Number(a?.n)) ? Number(a.n) : Number.POSITIVE_INFINITY;
        const bn = Number.isFinite(Number(b?.n)) ? Number(b.n) : Number.POSITIVE_INFINITY;
        if (an === bn) return 0;
        return an - bn;
    });

    // Render gap inputs
    const gapsHtml = orderedGaps.map((gap, idx) => {
        const savedValue = ctx.getAnswer(gap.id) || '';
        const gapNumber = Number.isFinite(Number(gap?.n)) ? Number(gap.n) : idx + 1;
        const style = gap.style || {};
        const fontSize = style.fontSize || 16;
        const opacity = style.opacity || 0.7;
        const showNumber = style.showNumberInside !== false;

        const left = `${gap.x * 100}%`;
        const top = `${gap.y * 100}%`;
        const width = `${gap.w * 100}%`;
        const height = `${gap.h * 100}%`;

        return `
            <div class="map-gap-box" data-id="${escapeHtml(gap.id)}" style="left: ${left}; top: ${top}; width: ${width}; height: ${height}; opacity: ${opacity};">
                ${showNumber ? `<span class="gap-number" data-qnum="${gapNumber}" style="font-size: ${fontSize}px; ${savedValue ? 'display: none;' : ''}">${gapNumber}</span>` : ''}
                <input 
                    type="text" 
                    class="map-input" 
                    data-gap-id="${escapeHtml(gap.id)}" 
                    data-qnum="${gapNumber}"
                    value="${escapeHtml(savedValue)}" 
                    style="font-size: ${fontSize}px;"
                    ${ro ? 'disabled readonly' : ''}
                />
            </div>
        `;
    }).join('');

    // Render text labels
    const textsHtml = texts.map(text => {
        const left = `${text.x * 100}%`;
        const top = `${text.y * 100}%`;
        const width = `${text.w * 100}%`;
        const height = `${text.h * 100}%`;

        const textStyle = `
            left: ${left};
            top: ${top};
            width: ${width};
            height: ${height};
            font-size: ${text.fontSize || 14}px;
            color: ${escapeHtml(text.color || '#111')};
            font-weight: ${text.bold ? 'bold' : 'normal'};
            text-align: ${text.align || 'left'};
        `;

        return `
            <div class="map-text-label" data-id="${escapeHtml(text.id)}" style="${textStyle}">
                ${escapeHtml(text.text || '')}
            </div>
        `;
    }).join('');

    return `
        <div class="gap-visual-block">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instructions ? `<div class="gap-instructions">${escapeHtml(instructions)}</div>` : ''}
            <div class="map-stage">
                <div class="map-container">
                    <img src="${image.dataUrl}" alt="Map" class="map-img" />
                    <div class="map-overlay">
                        <div class="text-layer">${textsHtml}</div>
                        <div class="gap-layer">${gapsHtml}</div>
                    </div>
                </div>
            </div>
        </div>
    `;
}