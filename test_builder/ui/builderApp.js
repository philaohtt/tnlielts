import { getState, dispatch, subscribe } from '../logic/builderStore.js';
import * as Actions from '../logic/actions.js';

const renderSharedUI = (state) => {
    // Sync Title (in forms or headers)
    document.querySelectorAll('[data-path="title"], #header-test-title').forEach(el => {
        const value = state.testDraft.title || '';
        if (el.tagName === 'INPUT' && el.value !== value) el.value = value;
        else if (el.tagName !== 'INPUT' && el.textContent !== value) el.textContent = value;
    });

    // Sync other form inputs
    document.querySelectorAll('[data-path]:not([data-path="title"])').forEach(el => {
        const path = el.dataset.path;
        const value = path.split('.').reduce((obj, key) => obj?.[key], state.testDraft) ?? '';
        if (el.value !== value) el.value = value;
    });

    // Render Validation Issues
    const issuesContainer = document.getElementById('validation-issues');
    if (issuesContainer) {
        issuesContainer.innerHTML = state.ui.issues.map(issue =>
            `<div class="issue-item ${issue.severity}">• ${issue.message}</div>`
        ).join('');
    }
};

const renderPageSpecifics = (state) => {
    // Render for builder-content.html structure tree
    const structureTree = document.getElementById('builder-structure-tree');
    if (structureTree) {
        structureTree.innerHTML = (state.testDraft.sections || []).map((s, idx) => `
            <div class="struct-item">
                <div class="struct-header"><span>▼</span> ${s.title || `Section ${idx + 1}`}</div>
                ${(s.parts || []).map(p => `<div class="struct-part"><span>${p.title}</span><small>${p.questions.length} Qs</small></div>`).join('')}
            </div>
        `).join('') || '<p style="padding: 15px; color: #999;">No sections yet. Click "Add Section" below.</p>';
    }

    // Render for builder-metadata.html summary
    const summaryList = document.getElementById('structure-list');
    if (summaryList) {
        summaryList.innerHTML = (state.testDraft.sections || []).map(s => `
            <div class="section-item">
                <div>
                    <div style="font-weight:600;">${s.title}</div>
                    <div style="font-size:12px; color:var(--text-muted);">${s.parts.length} Parts</div>
                </div>
                <div>⋮⋮</div>
            </div>
        `).join('') || '<div class="section-item"><p style="color: #999;">No sections added.</p></div>';
    }
};

document.addEventListener('DOMContentLoaded', () => {
    const fullRender = (state) => {
        renderSharedUI(state);
        renderPageSpecifics(state);
    };

    fullRender(getState());
    subscribe(fullRender);

    document.addEventListener('input', e => {
        if (e.target.dataset.path) Actions.updateField(e.target.dataset.path, e.target.value);
    });

    document.addEventListener('click', e => {
        const btn = e.target.closest('[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        if (action === 'publish') Actions.publishTest();
        if (action === 'preview') Actions.previewDraft();
        if (action === 'add-section') Actions.addSection('reading');
    });
});