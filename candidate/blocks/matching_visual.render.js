import { escapeHtml } from "../app/candidate.utils.js";

// filepath: c:\Users\GA\OneDrive\Teach and Learn\Admin\IELTS app html\candidate\blocks\matching_visual.render.js

export function renderMatchingVisualBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instructions = data.instructions || '';
    const image = data.image || {};
    const zones = Array.isArray(data.zones) ? data.zones : [];
    const options = Array.isArray(data.options) ? data.options : [];
    const allowReuse = data.allowReuse ?? false;
    const imageSizePct = data.imageSizePct || 85;
    const blockId = block.id || `matching_visual_${Math.random().toString(36).substr(2, 9)}`;

    if (!image.dataUrl) {
        return `
            <div class="matching-canvas-task">
                <div class="cbt-instruction-box">
                    Map image missing. Please contact administrator.
                </div>
            </div>
        `;
    }

    // Get saved answers for this block
    const savedMatches = ctx.getAnswer(blockId) || {};

    // Render zones (gaps and text labels)
    const zonesHtml = zones.map(zone => {
        const isText = zone.kind === 'text';
        const commonStyle = `left:${zone.x * 100}%; top:${zone.y * 100}%; width:${zone.w * 100}%; height:${zone.h * 100}%; font-size:${zone.fontSize || 14}px;`;

        if (isText) {
            return `
                <div class="mc-zone mc-zone--static" style="${commonStyle} color:${escapeHtml(zone.color || '#333')}; font-weight:${zone.bold ? 'bold' : 'normal'}; text-align:${zone.align || 'center'}; display:flex; align-items:center; justify-content:${zone.align === 'left' ? 'flex-start' : (zone.align === 'right' ? 'flex-end' : 'center')};">
                    ${escapeHtml(zone.text || '')}
                </div>
            `;
        }

        // Gap zone
        const zoneNum = zone.n;
        const matchedLetter = zoneNum ? savedMatches[zoneNum] : null;
        const matchedOption = matchedLetter ? options.find((opt, optIdx) => String.fromCharCode(65 + optIdx) === matchedLetter) : null;
        const hasAnswer = !!matchedOption;
        const opacity = hasAnswer ? 1 : (zone.opacity || 0.7);

        return `
            <div class="mc-zone mc-zone--gap is-droppable ${hasAnswer ? 'has-answer' : ''}" 
                 style="${commonStyle} background: rgba(255,255,255,${opacity});" 
                 data-zone-id="${escapeHtml(zone.id)}"
                 data-zone-num="${escapeHtml(zone.n || '')}">
                ${hasAnswer 
                    ? `<div class="mc-placed-pill" data-option-letter="${escapeHtml(matchedLetter)}" draggable="${!ro}">
                        <span>${escapeHtml(matchedOption.text || '')}</span>
                        ${!ro ? `<button class="mc-clr" data-zone-id="${escapeHtml(zone.id)}">×</button>` : ''}
                      </div>`
                    : `<div class="mc-zone-num">${zone.n || ''}</div>`
                }
            </div>
        `;
    }).join('');

    // Render options bank
    const bankHtml = options.map((option, idx) => {
        const letter = String.fromCharCode(65 + idx);
        const isUsed = !allowReuse && Object.values(savedMatches).includes(letter);
        return `
            <div class="mc-pill ${isUsed ? 'used' : ''}" 
                 draggable="${!ro && !isUsed}" 
                 data-option-letter="${escapeHtml(letter)}"
                 style="opacity: ${isUsed ? '0.4' : '1'}; cursor: ${!ro && !isUsed ? 'grab' : 'default'};">
                ${escapeHtml(option.text || '')}
            </div>
        `;
    }).join('');

    const html = `
        <div class="matching-canvas-task" data-block-id="${escapeHtml(blockId)}" data-allow-reuse="${allowReuse}" data-read-only="${ro}">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instructions ? `<div class="gap-instructions">${escapeHtml(instructions)}</div>` : ''}
            <div class="mc-layout">
                <div class="mc-canvas-side">
                    <div class="mc-card">
                        <div class="mc-img-container" style="max-width:${imageSizePct}%">
                            <img src="${image.dataUrl}" alt="diagram" class="mc-img">
                            <div class="mc-overlay">
                                ${zonesHtml}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="mc-bank-side">
                    <div class="mc-card">
                        <div class="mc-bank-title">Options</div>
                        <div class="mc-bank">
                            ${bankHtml}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    return html;
}