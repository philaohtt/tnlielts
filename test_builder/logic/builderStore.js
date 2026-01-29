import { createEmptyTest, normalizeTest } from './models.js';

// Persistence bridge for multi-page prototype
const SESSION_KEY = 'ielts_builder_draft';
const loadSession = () => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    return saved ? JSON.parse(saved) : createEmptyTest();
};

let state = {
    testDraft: loadSession(),
    ui: { selectedSectionId: null, selectedPartId: null, selectedQuestionId: null, issues: [] }
};

const listeners = new Set();
export const getState = () => JSON.parse(JSON.stringify(state));
export const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };

export const dispatch = (action) => {
    state = reducer(state, action);
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(state.testDraft));
    listeners.forEach(l => l(state));
};

function reducer(state, action) {
    let draft = JSON.parse(JSON.stringify(state.testDraft));
    switch (action.type) {
        case 'UPDATE_FIELD':
            const keys = action.payload.path.split('.');
            let curr = draft;
            for (let i = 0; i < keys.length - 1; i++) curr = curr[keys[i]] = curr[keys[i]] || {};
            curr[keys[keys.length - 1]] = action.payload.value;
            break;
        case 'ADD_SECTION':
            draft.sections.push(action.payload);
            break;
        case 'SET_ISSUES':
            return { ...state, ui: { ...state.ui, issues: action.payload } };
        case 'SELECT':
            return { ...state, ui: { ...state.ui, ...action.payload } };
        default: return state;
    }
    return { ...state, testDraft: normalizeTest(draft) };
}