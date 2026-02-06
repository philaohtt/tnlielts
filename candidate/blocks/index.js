/**
 * candidate/blocks/index.js
 * Unified block rendering interface for candidate and examiner views
 */

import { renderBlock as coreRenderBlock } from "../../core/index.js";

/**
 * Render a block with the provided context
 * @param {Object} block - Block object with type, id, data
 * @param {Object} ctx - Render context with getAnswer, setAnswer, etc.
 * @returns {string} Rendered HTML
 */
export function renderBlock(block, ctx) {
    return coreRenderBlock(block, ctx);
}

/**
 * Create a read-only context for examiner view
 * @param {string} skill - Skill name (listening, reading, etc.)
 * @param {Object} block - Block object
 * @param {Object} answers - Canonical answers object { gap: {}, mcq: {}, tfng: {}, matching: {} }
 * @returns {Object} Render context
 */
export function createReadOnlyContext(skill, block, answers) {
    const normalizedAnswers = normalizeAnswers(answers);
    
    return {
        readOnly: true,
        skill,

        // Used by GAP_FILL and MATCHING blocks
        getAnswer: (id) => {
            // For matching blocks, check answers.matching directly first
            if (answers.matching && answers.matching[id] !== undefined) {
                return answers.matching[id];
            }
            
            // For gap fills, check normalized answers
            if (normalizedAnswers[id] !== undefined) {
                return normalizedAnswers[id];
            }

            return '';
        },

        // Used by MCQ_SET renderer
        getMcqAnswer: (blockId, qId) => {
            // Try multiple key formats
            const k1 = `${blockId}:${qId}`;
            const k2 = `${blockId}_${qId}`;
            
            if (normalizedAnswers[k1] !== undefined) return normalizedAnswers[k1];
            if (normalizedAnswers[k2] !== undefined) return normalizedAnswers[k2];

            // Fuzzy match
            const found = Object.keys(normalizedAnswers).find(k =>
                typeof k === 'string' && k.includes(String(blockId)) && k.includes(String(qId))
            );
            if (found) return normalizedAnswers[found];

            return null;
        },

        // Used by TFNG renderer
        getTfngAnswer: (blockId, qId) => {
            // Try multiple key formats
            const k1 = `tfng:${blockId}:${qId}`;
            const k2 = `${blockId}:${qId}`;
            const k3 = `${blockId}_${qId}`;
            
            if (normalizedAnswers[k1] !== undefined) return normalizedAnswers[k1];
            if (normalizedAnswers[k2] !== undefined) return normalizedAnswers[k2];
            if (normalizedAnswers[k3] !== undefined) return normalizedAnswers[k3];

            // Fuzzy match
            const found = Object.keys(normalizedAnswers).find(k =>
                typeof k === 'string' && k.includes(String(blockId)) && k.includes(String(qId))
            );
            if (found) return normalizedAnswers[found];

            return null;
        }
    };
}

/**
 * Normalize canonical answer structure into flat map for renderer compatibility
 * @param {Object} rawAnswers - Canonical answers { gap: {}, mcq: {}, tfng: {}, matching: {} }
 * @returns {Object} Flat normalized map
 */
function normalizeAnswers(rawAnswers) {
    if (!rawAnswers || typeof rawAnswers !== 'object') return {};
    const normalized = {};

    // Merge nested maps if present
    if (rawAnswers.gap && typeof rawAnswers.gap === 'object') Object.assign(normalized, rawAnswers.gap);
    if (rawAnswers.mcq && typeof rawAnswers.mcq === 'object') Object.assign(normalized, rawAnswers.mcq);
    if (rawAnswers.tfng && typeof rawAnswers.tfng === 'object') Object.assign(normalized, rawAnswers.tfng);
    if (rawAnswers.matching && typeof rawAnswers.matching === 'object') Object.assign(normalized, rawAnswers.matching);
    if (rawAnswers.writing && typeof rawAnswers.writing === 'object') Object.assign(normalized, rawAnswers.writing);

    // Also merge any flat keys on the root level
    Object.entries(rawAnswers).forEach(([k, v]) => {
        if (k === 'gap' || k === 'mcq' || k === 'tfng' || k === 'matching' || k === 'writing') return;
        normalized[k] = v;
    });

    // Key aliasing: if keys contain ":" segments, also expose the last segment
    Object.entries({ ...normalized }).forEach(([k, v]) => {
        if (typeof k !== 'string') return;
        if (k.includes(':')) {
            const last = k.split(':').pop();
            if (last && normalized[last] === undefined) normalized[last] = v;
        }
    });

    return normalized;
}
