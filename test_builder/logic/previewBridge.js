export const openPreview = (testSpec, { mode }) => {
    const previewWindow = window.open('../pages/builder-preview.html', '_blank');
    
    // Use a listener to wait for the window to be ready, then send data
    const readyListener = (event) => {
        if (event.data.type === 'PREVIEW_READY') {
            previewWindow.postMessage({ type: 'IELTS_PREVIEW_LOAD', payload: testSpec, mode }, '*');
            window.removeEventListener('message', readyListener);
        }
    };
    window.addEventListener('message', readyListener);
};