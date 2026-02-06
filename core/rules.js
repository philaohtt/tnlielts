/**
 * core/rules.js
 * Shared constants and rules for the IELTS testing system
 * Eliminates magic strings and duplicated constants across the codebase
 */

/**
 * Skill execution order in IELTS exams
 * Used by: candidate flow, exam planning, progress tracking
 */
export const SKILL_ORDER = [
    'listening',
    'reading',
    'writing',
    'speaking'
];

/**
 * Default skill if none specified
 */
export const DEFAULT_SKILL = 'listening';

/**
 * Standard time allocations per skill (in minutes)
 * Can be overridden by exam-specific rules
 */
export const DEFAULT_TIME_RULES = {
    listening: 30,
    reading: 60,
    writing: 60,
    speaking: 15
};

/**
 * Answer type keys used in canonical answer structure
 * attempt.skills[skill].answers = { gap: {}, mcq: {}, tfng: {}, matching: {}, writing: {}, speaking: {} }
 */
export const ANSWER_TYPES = [
    'gap',
    'mcq',
    'tfng',
    'matching',
    'writing',
    'speaking'
];

/**
 * Block types that can be automatically scored by the system
 * Used by: auto-grading engine, examiner UI, test validation
 */
export const AUTO_SCORABLE_BLOCK_TYPES = [
    'gap_fill',
    'gap_fill_visual',
    'tfng',
    'mcq_set',
    'matching',
    'matching_visual',
    'matching_headings'
];

/**
 * Block types that require manual examiner grading
 * Used by: examiner UI, workflow routing
 */
export const MANUAL_GRADING_BLOCK_TYPES = [
    'writing_task',
    'speaking_task'
];

/**
 * All valid block types in the system
 */
export const ALL_BLOCK_TYPES = [
    ...AUTO_SCORABLE_BLOCK_TYPES,
    ...MANUAL_GRADING_BLOCK_TYPES
];

/**
 * Check if a skill name is valid
 * @param {string} skill - Skill name to validate
 * @returns {boolean} True if skill is valid
 */
export function isValidSkill(skill) {
    if (!skill) return false;
    const normalized = String(skill).toLowerCase().trim();
    return SKILL_ORDER.includes(normalized);
}

/**
 * Check if a block type can be auto-scored
 * @param {string|Object} blockOrType - Block object with type property, or type string
 * @returns {boolean} True if block can be auto-scored
 */
export function isAutoScorable(blockOrType) {
    let type;
    
    if (typeof blockOrType === 'string') {
        type = blockOrType;
    } else if (blockOrType && blockOrType.type) {
        type = blockOrType.type;
    } else {
        return false;
    }
    
    const normalizedType = String(type).toLowerCase().trim();
    return AUTO_SCORABLE_BLOCK_TYPES.includes(normalizedType);
}

/**
 * Check if a block type requires manual grading
 * @param {string|Object} blockOrType - Block object with type property, or type string
 * @returns {boolean} True if block requires manual grading
 */
export function requiresManualGrading(blockOrType) {
    let type;
    
    if (typeof blockOrType === 'string') {
        type = blockOrType;
    } else if (blockOrType && blockOrType.type) {
        type = blockOrType.type;
    } else {
        return false;
    }
    
    const normalizedType = String(type).toLowerCase().trim();
    return MANUAL_GRADING_BLOCK_TYPES.includes(normalizedType);
}

/**
 * Normalize skill name to lowercase standard format
 * @param {string} skill - Skill name (any case)
 * @returns {string} Normalized skill name
 */
export function normalizeSkill(skill) {
    return String(skill || DEFAULT_SKILL).toLowerCase().trim();
}

/**
 * Get the next skill in the standard order
 * @param {string} currentSkill - Current skill name
 * @returns {string|null} Next skill name, or null if at the end
 */
export function getNextSkillInOrder(currentSkill) {
    const normalized = normalizeSkill(currentSkill);
    const currentIndex = SKILL_ORDER.indexOf(normalized);
    
    if (currentIndex === -1 || currentIndex === SKILL_ORDER.length - 1) {
        return null;
    }
    
    return SKILL_ORDER[currentIndex + 1];
}

/**
 * Get default time for a skill (in minutes)
 * @param {string} skill - Skill name
 * @returns {number} Time in minutes
 */
export function getDefaultTimeForSkill(skill) {
    const normalized = normalizeSkill(skill);
    return DEFAULT_TIME_RULES[normalized] || 60;
}
