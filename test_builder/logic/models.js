export const generateId = () => `id_${Math.random().toString(36).substr(2, 9)}_${Date.now()}`;

export const normalizeQuestion = (q) => {
    if (!q) return null;
    const res = { ...q };
    if (!res.id) res.id = generateId();
    if (!res.prompt) res.prompt = 'New Question';
    if (!res.options) res.options = [];
    
    // Ensure placeholders for MCQ
    if (['mcq_single', 'mcq_multi'].includes(res.type) && res.options.length < 2) {
        res.options = [{ id: generateId(), text: 'Option 1' }, { id: generateId(), text: 'Option 2' }];
    }
    return res;
};

export const normalizePart = (p) => {
    if (!p) return null;
    const res = { ...p };
    if (!res.id) res.id = generateId();
    res.questions = (res.questions || []).map(normalizeQuestion).filter(Boolean);
    return res;
};

export const normalizeSection = (s) => {
    if (!s) return null;
    const res = { ...s };
    if (!res.id) res.id = generateId();
    res.parts = (res.parts || []).map(normalizePart).filter(Boolean);
    return res;
};

export const normalizeTest = (test) => {
    if (!test) return null;
    const res = { ...test };
    if (!res.id) res.id = generateId();
    if (!res.title) res.title = 'Untitled IELTS Test';
    
    let globalCounter = 1;
    res.sections = (res.sections || []).map(s => {
        const cleanS = normalizeSection(s);
        cleanS.parts.forEach(p => {
            p.questions.forEach(q => {
                q.displayNumber = globalCounter++; // Global Source of Truth
            });
        });
        return cleanS;
    });
    return res;
};

export const createQuestion = (type) => normalizeQuestion({ type });
export const createPart = () => normalizePart({ questions: [createQuestion('mcq_single')] });
export const createSection = () => normalizeSection({ title: 'New Section', parts: [createPart()] });
export const createEmptyTest = () => normalizeTest({ sections: [] });