import { normalizeTest } from './models.js';

export const openPreview = (testDraft) => {
    const cleanData = normalizeTest(testDraft);
    const previewWindow = window.open('../pages/builder-preview.html', '_blank');
    
    const listener = (event) => {
        if (event.data.type === 'PREVIEW_READY') {
            previewWindow.postMessage({ type: 'IELTS_PREVIEW_LOAD', payload: cleanData }, '*');
            window.removeEventListener('message', listener);
        }
    };
    window.addEventListener('message', listener);
};