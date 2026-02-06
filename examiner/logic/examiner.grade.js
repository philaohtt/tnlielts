/**
 * examiner.grade.js
 * Auto-scoring module for objective blocks (Listening/Reading)
 */

import { ANSWER_TYPES, AUTO_SCORABLE_BLOCK_TYPES, isAutoScorable } from "../../core/rules.js";

// Re-export for backward compatibility
export { isAutoScorable };

/**
 * Main scoring function
 */
export function computeAutoScore({ skill, blocks, attempt, answers }) {
    const result = {
        skill,
        computedAt: Date.now(),
        totalQuestions: 0,
        correct: 0,
        accuracy: 0,
        byBlock: [],
        warnings: []
    };

    if (!blocks || !Array.isArray(blocks)) {
        result.warnings.push('No blocks provided');
        return result;
    }

    // 1. Extract Candidate Answers (Canonical Only)
    let candidateAnswers = extractAnswersCanonical(attempt, skill, result.warnings);
    if (!candidateAnswers) {
        // Fallback for legacy calls
        candidateAnswers = normalizeAnswerMapFromProvided(answers);
    }

    // 2. Score Each Block
    blocks.forEach((rawBlock) => {
        const block = normalizeBlockShape(rawBlock);
        if (!block) return;

        // Skip non-scorable blocks
        if (!isAutoScorable(block.type)) return;

        const blockResult = scoreBlockStrategy(block, candidateAnswers, skill);
        
        if (blockResult) {
            result.byBlock.push(blockResult);
            result.totalQuestions += blockResult.total;
            result.correct += blockResult.correct;
            if(blockResult.warning) result.warnings.push(blockResult.warning);
        }
    });

    // 3. Calculate Final Accuracy
    result.accuracy = result.totalQuestions > 0
        ? Math.round((result.correct / result.totalQuestions) * 100)
        : 0;

    return result;
}

/**
 * STRATEGY DISPATCHER
 */
function scoreBlockStrategy(block, allAnswers, skill) {
    const type = (block.type || '').toLowerCase();
    
    switch (type) {
        case 'gap_fill':
        case 'gap_fill_visual':
            return scoreGapFill(block, allAnswers.gap);
        case 'mcq_set':
            return scoreMcqSet(block, allAnswers.mcq);
        case 'tfng':
            return scoreTfng(block, allAnswers.tfng);
        case 'matching':
        case 'matching_visual':
        case 'matching_headings':
            return scoreMatching(block, allAnswers.matching);
        default:
            return {
                blockId: block.id,
                label: `Unknown Type: ${type}`,
                correct: 0,
                total: 0,
                warning: `No grading strategy for ${type}`
            };
    }
}

/**
 * ----------------------------------------------------------------------
 * SCORING STRATEGIES
 * ----------------------------------------------------------------------
 */

// 1. GAP FILL
function scoreGapFill(block, candidateGapAnswers) {
    const correctAnswers = getCorrectAnswerKey(block);
    let correct = 0;
    let total = 0;

    const keys = Object.keys(correctAnswers);
    keys.forEach(gapId => {
        total++;
        
        const candVal = normalize(candidateGapAnswers?.[gapId]);
        
        // Correct answers can be an array or single value
        let allowed = correctAnswers[gapId];
        
        // Flatten and normalize allowed answers
        allowed = normalizeMultipleAnswers(allowed);

        if (candVal && allowed.includes(candVal)) {
            correct++;
        }
    });

    return {
        blockId: block.id,
        type: block.type,
        label: getBlockLabel(block),
        correct,
        total
    };
}

// 2. MCQ SET
function scoreMcqSet(block, candidateMcqAnswers) {
    const data = block.data || {};
    const questions = data.questions || [];
    let correct = 0;
    let total = 0;

    questions.forEach(q => {
        const qId = q.id;
        // Determine weight: "Choose TWO" = 2 points
        const weight = q.correctAnswerCount || (q.correctIndices?.length) || (q.allowMultiple ? 2 : 1);
        
        total += weight;

        const key = `${block.id}:${qId}`;
        // Try precise key first, fall back to qId
        let candVal = candidateMcqAnswers?.[key] ?? candidateMcqAnswers?.[qId];

        let candIndices = parseMcqSelection(candVal);

        let correctIndices = q.correctIndices || [];
        if (!Array.isArray(correctIndices)) correctIndices = [q.correctIndex || 0];

        if (q.allowMultiple || weight > 1) {
            const intersection = candIndices.filter(c => correctIndices.includes(c));
            correct += intersection.length; 
        } else {
            if (candIndices.length > 0 && correctIndices.includes(candIndices[0])) {
                correct++;
            }
        }
    });

    return {
        blockId: block.id,
        type: block.type,
        label: getBlockLabel(block),
        correct,
        total
    };
}

// 3. TFNG / YNNG
function scoreTfng(block, candidateTfngAnswers) {
    const correctAnswers = getCorrectAnswerKey(block);
    let correct = 0;
    let total = 0;

    Object.keys(correctAnswers).forEach((qId) => {
        total++;
        const key = `${block.id}:${qId}`;
        // Try specific key, fallback to simple ID
        const candVal = normalizeTFNG(candidateTfngAnswers?.[key] || candidateTfngAnswers?.[qId]);
        const correctVal = normalizeTFNG(correctAnswers[qId]);

        if (candVal && candVal === correctVal) {
            correct++;
        }
    });

    return {
        blockId: block.id,
        type: block.type,
        label: getBlockLabel(block),
        correct,
        total
    };
}

// 4. MATCHING (Generic)
function scoreMatching(block, candidateMatchingAnswers) {
    const blockId = block.id;
    let correct = 0;
    let total = 0;

    // 1. Get Candidate Answers
    let candObj = candidateMatchingAnswers?.[blockId] || {};
    if (typeof candObj === 'string') {
        try { candObj = JSON.parse(candObj); } catch { candObj = {}; }
    }

    // 2. Get Correct Answers
    const correctAnswers = getCorrectAnswerKey(block);
    const keys = Object.keys(correctAnswers);

    keys.forEach((itemKey) => {
        total++;
        
        const candidateValue = candObj[itemKey]; // Usually "A", "B", etc.
        const correctValue = String(correctAnswers[itemKey]).trim(); // Resolved to "A", "B" via getCorrectAnswerKey
        
        if (normalize(candidateValue) === normalize(correctValue)) {
            correct++;
        }
    });

    return {
        blockId: block.id,
        type: block.type,
        label: getBlockLabel(block),
        correct,
        total
    };
}

/**
 * ----------------------------------------------------------------------
 * CORE HELPER: getCorrectAnswerKey
 * Extracts a normalized { id: correctVal } map from ANY block data structure.
 * Automatically resolves Option IDs to Letters if options are present.
 * ----------------------------------------------------------------------
 */
function getCorrectAnswerKey(block) {
    const data = block.data || {};
    const map = {};
    const options = Array.isArray(data.options) ? data.options : [];

    // Helper: Convert an Option ID to a Letter (A, B, C...)
    const resolveValue = (val) => {
        if (!val) return val;
        // If it looks like an ID and we have options, try to resolve to Letter
        if (options.length > 0 && typeof val === 'string' && val.length > 2) { 
            const idx = options.findIndex(o => o.id === val);
            if (idx !== -1) {
                return String.fromCharCode(65 + idx); // 0 -> A, 1 -> B
            }
        }
        return val;
    };

    // 1. ZONES Array (Used by Matching Visual - Primary Source)
    if (Array.isArray(data.zones)) {
        data.zones.forEach(zone => {
            // Only care about gaps (not static text) that have a number or ID
            if (zone.kind === 'text') return;
            const id = zone.n || zone.id; // Prefer N (1, 2, 3) for matching keys
            if (!id) return;

            let val = zone.correctOptionId || zone.answerKey || zone.answers || zone.correctAnswers || zone.answer || zone.value;
            
            if (Array.isArray(val) && val.length === 1) val = val[0];
            
            if (val != null) {
                // IMPORTANT: Resolve ID to Letter
                map[id] = resolveValue(val);
            }
        });
        if (Object.keys(map).length > 0) return map;
    }

    // 2. GAPS Array (Used by Gap Fill & Fallback for Visual)
    if (Array.isArray(data.gaps)) {
        data.gaps.forEach(gap => {
            const id = gap.id || gap.gapId || gap.n;
            if (!id) return;
            
            let val = gap.correctOptionId || gap.answerKey || gap.answers || gap.correctAnswers || gap.answer || gap.value;
            
            if (Array.isArray(val) && val.length === 1) val = val[0];
            if (val != null) {
                map[id] = resolveValue(val);
            }
        });
        if (Object.keys(map).length > 0) return map;
    }

    // 3. ITEMS Array (Used by Standard Matching)
    if (Array.isArray(data.items)) {
        data.items.forEach((item, idx) => {
            // Standard matching uses 1-based index
            const id = String(idx + 1); 
            const explicitId = item.id || item.itemId;

            let val = item.key || item.correct || item.answerKey || item.correctAnswers;
            
            if (val != null) {
                // Items usually store Key (Letter) directly, but run resolve just in case
                val = resolveValue(val);
                map[id] = val;
                if (explicitId) map[explicitId] = val;
            }
        });
        if (Object.keys(map).length > 0) return map;
    }

    // 4. SLOTS Array (Used by Matching Headings)
    if (Array.isArray(data.slots)) {
        data.slots.forEach(slot => {
            const id = slot.slotId || slot.id;
            let val = data.answerKey?.[id] || slot.correct || slot.answer;
            if (id && val != null) {
                map[id] = resolveValue(val);
            }
        });
        if (Object.keys(map).length > 0) return map;
    }

    // 5. QUESTIONS Array (TFNG)
    if (Array.isArray(data.questions)) {
        data.questions.forEach((q, idx) => {
            const id = q.id || idx; 
            const val = q.answer;
            if (val) map[id] = val;
        });
        if (Object.keys(map).length > 0) return map;
    }

    // 6. Generic Objects (Fallbacks)
    if (data.answerKey && typeof data.answerKey === 'object') return data.answerKey;
    if (data.correctAnswers && typeof data.correctAnswers === 'object') return data.correctAnswers;
    if (data.answers && typeof data.answers === 'object') return data.answers;

    return map;
}

/**
 * ----------------------------------------------------------------------
 * GENERAL HELPERS
 * ----------------------------------------------------------------------
 */

function normalize(val) {
    return String(val || '').trim().toLowerCase();
}

function normalizeTFNG(val) {
    const s = normalize(val);
    if (['true', 't', 'yes', 'y'].includes(s)) return 'TRUE';
    if (['false', 'f', 'no', 'n'].includes(s)) return 'FALSE';
    if (['not given', 'ng', 'notgiven'].includes(s)) return 'NOT GIVEN';
    return '';
}

function normalizeMultipleAnswers(value) {
    if (Array.isArray(value)) return value.map(normalize);
    const text = String(value || '').trim();
    if (text.includes('|') || text.includes('/') || text.includes(';')) {
        return text.split(/[|/;]/).map(normalize);
    }
    return [normalize(text)];
}

function parseMcqSelection(val) {
    if (val === undefined || val === null) return [];
    if (Array.isArray(val)) return val.map(Number);
    if (typeof val === 'number') return [val];
    if (typeof val === 'string' && val.startsWith('[')) {
        try { return JSON.parse(val).map(Number); } catch(e){}
    }
    return [Number(val)];
}

function getBlockLabel(block) {
    return block.data?.title || block.data?.instructions || block.type;
}

function normalizeBlockShape(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const data = raw.data || raw;
    const type = (raw.type || data.type || '').toString().toLowerCase().trim();
    const id = raw.id || data.id || '';
    if (!type) return null;
    return { id, type, data };
}

function extractAnswersCanonical(attempt, skill, warnings) {
    if (!attempt || !attempt.skills) return null;
    const normalizedSkill = String(skill).toLowerCase();
    const skillData = attempt.skills[normalizedSkill];
    if (!skillData || !skillData.answers) return null;
    
    // Ensure all buckets exist
    const out = { gap: {}, mcq: {}, tfng: {}, matching: {}, writing: {} };
    Object.assign(out, skillData.answers);
    return out;
}

function normalizeAnswerMapFromProvided(answers) {
    const a = (answers && typeof answers === 'object') ? answers : {};
    return {
        gap: a.gap || {},
        mcq: a.mcq || {},
        tfng: a.tfng || {},
        matching: a.matching || {},
        writing: a.writing || {}
    };
}