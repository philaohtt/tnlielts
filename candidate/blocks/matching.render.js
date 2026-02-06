import { escapeHtml } from "../app/candidate.utils.js";

export function renderMatchingBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const instructions = data.instructions || '';
    const config = data.config || {};
    const items = Array.isArray(data.items) ? data.items : [];
    const options = Array.isArray(data.options) ? data.options : [];
    const blockId = block.id || 'matching_' + Math.random().toString(36).substr(2, 9);
    const allowReuse = config.allowReuse ?? false;

    const itemColumnTitle = config.itemColumnTitle || 'Items';
    const optionColumnTitle = config.optionColumnTitle || 'Options';
    const showLetters = config.showLetters !== false;

    // Get saved matches for this block
    const savedMatches = ctx.getAnswer(blockId) || {};

    const itemsHtml = items.length > 0 
        ? items.map((item, idx) => {
            const itemNumber = idx + 1;
            const matchedLetter = savedMatches[itemNumber];
            const matchedOption = matchedLetter ? options.find((opt, optIdx) => String.fromCharCode(65 + optIdx) === matchedLetter) : null;
            const hasMatch = matchedLetter && matchedOption;
            return `
                <div class="matching-item" data-item-num="${itemNumber}" style="padding: 12px; margin-bottom: 8px; border: 2px solid ${hasMatch ? '#dbeafe' : '#e2e8f0'}; border-radius: 6px; background: ${hasMatch ? '#f0f9ff' : '#fff'}; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; gap: 12px; margin-bottom: 8px;">
                        <div class="matching-item-num" style="width: 32px; flex-shrink: 0; font-weight: 600; color: #64748b;">${itemNumber}.</div>
                        <div style="flex: 1; color: #333;">${escapeHtml(item.text || '')}</div>
                    </div>
                    <div class="matching-selected-area" data-item-num="${itemNumber}" draggable="${!ro && hasMatch ? 'true' : 'false'}" style="padding: 8px; border: 1.5px dashed ${hasMatch ? '#0ea5e9' : '#cbd5e1'}; border-radius: 4px; background: ${hasMatch ? '#e0f2fe' : '#f8fafc'}; min-height: 28px; display: flex; align-items: center; gap: 8px; color: ${hasMatch ? '#1a202c' : '#999'}; font-weight: ${hasMatch ? '600' : '400'}; cursor: ${!ro && hasMatch ? 'grab' : 'default'};">
                        ${hasMatch ? `<span class="matching-match-text" style="flex: 1; font-size: 13px;">${escapeHtml(matchedOption.text || '')}</span>` : '<span style="font-size: 13px;">Drop option here</span>'}
                    </div>
                </div>
            `;
        }).join('')
        : '<div style="padding: 16px; color: #999; text-align: center;">No items found.</div>';

    const optionsHtml = options.length > 0
        ? options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx);
            const isUsed = !allowReuse && Object.values(savedMatches).includes(letter);
            return `
                <div class="matching-option" draggable="${!ro && !isUsed}" data-option-letter="${letter}" style="padding: 12px; margin-bottom: 8px; border: 2px solid ${isUsed ? '#cbd5e1' : '#2563eb'}; border-radius: 6px; background: ${isUsed ? '#f3f4f6' : '#f0f9ff'}; color: ${isUsed ? '#999' : '#1a202c'}; cursor: ${!ro && !isUsed ? 'move' : 'default'}; transition: all 0.2s; user-select: none; opacity: ${isUsed ? '0.6' : '1'};">
                    <div style="display: flex; gap: 12px;">
                        ${showLetters ? `<div style="width: 32px; flex-shrink: 0; font-weight: 600; color: ${isUsed ? '#999' : '#2563eb'}; font-size: 16px;">${letter}.</div>` : ''}
                        <div style="flex: 1;">${escapeHtml(option.text || '')}</div>
                    </div>
                </div>
            `;
        }).join('')
        : '<div style="padding: 16px; color: #999; text-align: center;">No options found.</div>';

    return `
        <div class="matching-block" data-block-id="${blockId}" data-allow-reuse="${allowReuse}" data-read-only="${ro}">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${instructions ? `<div class="gap-instructions">${escapeHtml(instructions)}</div>` : ''}
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 16px;">
                <div>
                    <div style="font-weight: 700; color: #1a202c; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #64748b;">
                        ${escapeHtml(itemColumnTitle)}
                    </div>
                    <div style="color: #333;">${itemsHtml}</div>
                </div>
                <div>
                    <div style="font-weight: 700; color: #1a202c; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #64748b;">
                        ${escapeHtml(optionColumnTitle)}
                    </div>
                    <div class="matching-options-container" style="color: #333;">${optionsHtml}</div>
                </div>
            </div>
        </div>
    `;
}