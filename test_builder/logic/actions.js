import { dispatch, getState } from './builderStore.js';
import { createSection } from './models.js';
import { validateTestSpec } from './validate.js';
import { openPreview } from './previewBridge.js';

export const updateField = (path, value) => {
    dispatch({ type: 'UPDATE_FIELD', payload: { path, value } });
};

export const addSection = (type) => dispatch({ type: 'ADD_SECTION', payload: createSection(type) });
export const deleteSection = (id) => dispatch({ type: 'DELETE_SECTION', payload: id });
export const select = (ids) => dispatch({ type: 'SELECT', payload: ids });

export const previewDraft = () => {
    const { testDraft } = getState();
    const validation = validateTestSpec(testDraft, 'draft');
    dispatch({ type: 'SET_ISSUES', payload: validation.issues });
    openPreview(testDraft, { mode: 'draft' });
};

export const publishTest = () => {
    const { testDraft } = getState();
    const validation = validateTestSpec(testDraft, 'publish');
    dispatch({ type: 'SET_ISSUES', payload: validation.issues });
    if (validation.ok) {
        dispatch({ type: 'PUBLISH' });
        alert("Test Published Successfully!");
    } else {
        alert("Cannot publish. Please fix the validation errors.");
    }
};