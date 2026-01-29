export const SKILLS = {
    LISTENING: 'listening',
    READING: 'reading',
    WRITING: 'writing',
    SPEAKING: 'speaking'
};

export const QUESTION_TYPES = {
    MCQ_SINGLE: 'mcq_single',
    MCQ_MULTI: 'mcq_multi',
    SHORT_ANSWER: 'short_answer',
    SENTENCE_COMPLETION: 'sentence_completion',
    MATCHING: 'matching',
    TFNG: 'true_false_not_given',
    YNNG: 'yes_no_not_given',
    DROPDOWN: 'dropdown_fill',
    ESSAY: 'essay',
    SPEAKING_RESPONSE: 'speaking_response'
};

const IELTS_RULESETS = {
    [SKILLS.LISTENING]: { requiredSections: 4, targetTotalQuestions: 40, allowedTypes: [QUESTION_TYPES.MCQ_SINGLE, QUESTION_TYPES.MCQ_MULTI, QUESTION_TYPES.SHORT_ANSWER, QUESTION_TYPES.SENTENCE_COMPLETION, QUESTION_TYPES.MATCHING, QUESTION_TYPES.DROPDOWN] },
    [SKILLS.READING]: { requiredSections: 3, targetTotalQuestions: 40, allowedTypes: [QUESTION_TYPES.MCQ_SINGLE, QUESTION_TYPES.MCQ_MULTI, QUESTION_TYPES.SHORT_ANSWER, QUESTION_TYPES.SENTENCE_COMPLETION, QUESTION_TYPES.MATCHING, QUESTION_TYPES.TFNG, QUESTION_TYPES.YNNG, QUESTION_TYPES.DROPDOWN] },
    [SKILLS.WRITING]: { requiredSections: 2, targetTotalQuestions: 2, allowedTypes: [QUESTION_TYPES.ESSAY] },
    [SKILLS.SPEAKING]: { requiredSections: 3, targetTotalQuestions: 3, allowedTypes: [QUESTION_TYPES.SPEAKING_RESPONSE] }
};

export const getRuleset = (skill) => IELTS_RULESETS[skill?.toLowerCase()] || IELTS_RULESETS[SKILLS.READING];

export const isQuestionTypeAllowed = (skill, type) => getRuleset(skill).allowedTypes.includes(type);