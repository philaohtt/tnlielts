import { escapeHtml } from "../app/candidate.utils.js";

export function renderMatchingHeadingsBlock(block, ctx) {
    const ro = !!ctx.readOnly;
    const data = block.data || {};
    const numbering = data.numbering || '';
    const blockInstructions = data.instructions || ''; // Task instructions
    const options = Array.isArray(data.options) ? data.options : [];
    const slots = Array.isArray(data.slots) ? data.slots : [];
    
    const blockId = block.id || 'matching_headings_' + Math.random().toString(36).substr(2, 9);
    const allowReuse = data.allowReuse ?? false;

    // Get saved matches for this block
    // Format: { "mh_slot_id": "A", "mh_slot_id_2": "C" }
    const savedMatches = ctx.getAnswer(blockId) || {};

    // Build a map of slot IDs to their matched letters for quick lookup
    const slotToLetter = {};
    Object.entries(savedMatches).forEach(([slotId, letter]) => {
        slotToLetter[slotId] = letter;
    });

    // Create draggable headings pills (with letters) for drag-drop interaction
    const draggableHeadingsHtml = options.length > 0
        ? options.map((option, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C...
            const isUsed = !allowReuse && Object.values(slotToLetter).includes(letter);
            
            return `
                <div class="matching-heading-pill" 
                     draggable="${!ro && !isUsed}" 
                     data-option-letter="${letter}" 
                     style="display: inline-flex; align-items: center; background: #fff; border: 1px solid #cbd5e1; border-radius: 4px; padding: 8px 12px; font-size: 13px; cursor: ${!ro && !isUsed ? 'grab' : 'default'}; user-select: none; margin: 4px; opacity: ${isUsed ? '0.5' : '1'}; transition: opacity 0.2s; box-shadow: 0 1px 2px rgba(0,0,0,0.05);">
                    <span style="font-weight: bold; color: #0072bc; background: #ebf8ff; padding: 2px 6px; border-radius: 3px; font-size: 11px; margin-right: 8px;">${letter}</span>
                    <span style="max-width: 300px;">${escapeHtml(option.text || '')}</span>
                </div>
            `;
        }).join('')
        : '<div style="color: #999; font-style: italic; text-align: center; padding: 16px;">No headings defined.</div>';

    return `
        <div class="matching-headings-block" data-block-id="${blockId}" data-allow-reuse="${allowReuse}" data-read-only="${ro}">
            ${numbering ? `<div class="gap-numbering">${escapeHtml(numbering)}</div>` : ''}
            ${blockInstructions ? `<div class="gap-instructions">${blockInstructions}</div>` : ''}
            
            <div style="display: flex; flex-direction: column; gap: 16px; margin-top: 16px;">
                
                <!-- Draggable Headings Bank (with letters) -->
                <div class="headings-draggable-bank" style="background: #f3f9ff; padding: 16px; border-radius: 8px; border: 1px solid #c2e0ff;">
                    <div style="font-weight: 700; color: #0272a5; margin-bottom: 12px; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
                        List of Headings
                    </div>
                    <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                        ${draggableHeadingsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;
}