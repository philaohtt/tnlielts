export const generateId = () => `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;

export const createQuestion = (type = 'mcq_single') => ({
    id: generateId(),
    type,
    prompt: 'New Question',
    instructions: '',
    options: ['mcq_single', 'mcq_multi'].includes(type) ? [{ id: generateId(), text: 'Option 1' }] : [],
    correctAnswer: null,
    metadata: { difficulty: 'medium', tags: [] }
});

export const createPart = (sectionId) => ({
    id: generateId(),
    sectionId,
    title: 'New Part',
    stimulus: { id: generateId(), type: 'text', content: 'Sample stimulus text...' },
    questions: [createQuestion('mcq_single')]
});

export const createSection = (type = 'reading') => ({
    id: generateId(),
    type,
    title: 'New Section',
    parts: [createPart(this.id)]
});

export const createEmptyTest = () => ({
    id: generateId(),
    title: 'New IELTS Test',
    code: `IELTS-${new Date().getFullYear()}`,
    skill: 'reading',
    durationMinutes: 60,
    instructions: 'Please read the instructions carefully.',
    sections: [],
    status: 'draft'
});