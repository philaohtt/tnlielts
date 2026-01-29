import { createEmptyTest } from './models.js';
import { normalizeTestSpec } from './rules.js';

let state = {
    testDraft: normalizeTestSpec(createEmptyTest()),
    testPublished: null,
    ui: {
        selectedSectionId: null,
        selectedPartId: null,
        selectedQuestionId: null,
        issues: [],
        dirty: false
    }
};

const listeners = new Set();

export const getState = () => JSON.parse(JSON.stringify(state));

export const subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
};

export const dispatch = (action) => {
    state = reducer(state, action);
    listeners.forEach(l => l(state));
};

function reducer(state, action) {
    let newDraft = state.testDraft ? JSON.parse(JSON.stringify(state.testDraft)) : createEmptyTest();

    switch (action.type) {
        case 'UPDATE_FIELD': {
            const { path, value } = action.payload;
            const keys = path.split('.');
            let current = newDraft;
            for (let i = 0; i < keys.length - 1; i++) {
                if (!current[keys[i]]) current[keys[i]] = {};
                current = current[keys[i]];
            }
            current[keys[keys.length - 1]] = value;
            break;
        }
        case 'ADD_SECTION':
            newDraft.sections.push(action.payload);
            break;
        case 'DELETE_SECTION':
            newDraft.sections = newDraft.sections.filter(s => s.id !== action.payload);
            break;
        case 'SELECT':
            return { ...state, ui: { ...state.ui, ...action.payload } };
        case 'SET_ISSUES':
            return { ...state, ui: { ...state.ui, issues: action.payload } };
        case 'PUBLISH':
            return { ...state, testPublished: JSON.parse(JSON.stringify(state.testDraft)), ui: { ...state.ui, dirty: false } };
        default:
            return state;
    }

    return { ...state, testDraft: normalizeTestSpec(newDraft), ui: { ...state.ui, dirty: true } };
}