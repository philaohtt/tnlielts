import { dispatch, getState } from './builderStore.js';
import { createSection, normalizeTest } from './models.js';
import { validateTestSpec } from './validate.js';
import { openPreview } from './previewBridge.js';

export const updateField = (path, value) => {
    // Reducer handles normalization, but we can pre-validate or clean here if needed
    dispatch({ type: 'UPDATE_FIELD', payload: { path, value } });
};

export const addSection = (type) => {
    const section = createSection(type);
    dispatch({ type: 'ADD_SECTION', payload: section });
};

export const deleteSection = (id) => dispatch({ type: 'DELETE_SECTION', payload: id });

export const previewDraft = () => {
    const { testDraft } = getState();
    // Re-normalize before preview to catch any manual mutation leaks
    const cleanDraft = normalizeTest(testDraft);
    const validation = validateTestSpec(cleanDraft, 'draft');
    
    dispatch({ type: 'SET_ISSUES', payload: validation.issues });
    openPreview(cleanDraft, { mode: 'draft' });
};

export const publishTest = () => {
    const { testDraft } = getState();
    const cleanDraft = normalizeTest(testDraft);
    const validation = validateTestSpec(cleanDraft, 'publish');
    
    dispatch({ type: 'SET_ISSUES', payload: validation.issues });
    if (validation.ok) {
        dispatch({ type: 'PUBLISH' });
        alert("Test Published Successfully!");
    } else {
        alert(`Cannot publish. ${validation.issues.filter(i => i.severity === 'error').length} blocking issues found.`);
    }
};