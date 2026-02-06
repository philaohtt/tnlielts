import { renderGapFillBlock } from "../candidate/blocks/gap_fill.render.js";
import { renderGapFillVisualBlock } from "../candidate/blocks/gap_fill_visual.render.js";
import { renderMcqSetBlock } from "../candidate/blocks/mcq_set.render.js";
import { renderMatchingBlock } from "../candidate/blocks/matching.render.js";
import { renderMatchingVisualBlock } from "../candidate/blocks/matching_visual.render.js";
import { renderMatchingHeadingsBlock } from "../candidate/blocks/matching_headings.render.js";
import { renderTfngBlock } from "../candidate/blocks/tfng.render.js";
import { AUTO_SCORABLE_BLOCK_TYPES } from "./rules.js";

// Map of block types to their render functions
// Uses AUTO_SCORABLE_BLOCK_TYPES from shared rules
export const blockRenderers = {
    gap_fill: renderGapFillBlock,
    gap_fill_visual: renderGapFillVisualBlock,
    mcq_set: renderMcqSetBlock,
    matching: renderMatchingBlock,
    matching_visual: renderMatchingVisualBlock,
    matching_headings: renderMatchingHeadingsBlock,
    tfng: renderTfngBlock
};

export function renderBlock(block, ctx) {
    if (!block || !block.type) return '';
    const type = String(block.type || '').toLowerCase().trim();
    const renderer = blockRenderers[type];
    if (typeof renderer !== 'function') return '';
    return renderer(block, ctx);
}