import { generateId } from './models.js';

export const getAllowedQuestionTypes = (sectionType) => {
    const common = ['mcq_single', 'mcq_multi', 'short_answer', 'sentence_completion', 'matching'];
    if (sectionType === 'reading') return [...common, 'true_false_not_given', 'dropdown_fill'];
    if (sectionType === 'writing') return ['essay'];
    if (sectionType === 'speaking') return ['speaking_response'];
    return common;
};

export const normalizeTestSpec = (testSpec) => {
    if (!testSpec) return null;
    const normalized = JSON.parse(JSON.stringify(testSpec));
    if (!normalized.id) normalized.id = generateId();
    if (!normalized.sections) normalized.sections = [];

    normalized.sections = normalized.sections
        .filter(s => s !== null)
        .map((section, sIdx) => {
            if (!section.id) section.id = generateId();
            section.order = sIdx;
            if (!section.parts) section.parts = [];
            section.parts = section.parts
                .filter(p => p !== null)
                .map((part, pIdx) => {
                    if (!part.id) part.id = generateId();
                    part.order = pIdx;
                    part.sectionId = section.id;
                    if (!part.questions) part.questions = [];
                    part.questions = part.questions
                        .filter(q => q !== null)
                        .map((q, qIdx) => {
                            if (!q.id) q.id = generateId();
                            q.order = qIdx;
                            ensureQuestionPayloadDefaults(q);
                            return q;
                        });
                    return part;
                });
            return section;
        });
    return normalized;
};

function ensureQuestionPayloadDefaults(q) {
    if (['mcq_single', 'mcq_multi'].includes(q.type)) {
        if (!Array.isArray(q.options)) q.options = [];
        if (q.options.length === 0) {
            q.options.push({ id: generateId(), text: 'Default Option' });
        }
    }
    if (q.type === 'true_false_not_given') {
        q.options = [
            { id: 'T', text: 'TRUE' },
            { id: 'F', text: 'FALSE' },
            { id: 'NG', text: 'NOT GIVEN' }
        ];
    }
}