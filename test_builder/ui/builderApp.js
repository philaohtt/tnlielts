import { getState, subscribe, dispatch } from '../logic/builderStore.js';
import * as Actions from '../logic/actions.js';
import { validateTestSpec } from '../logic/validate.js';

const render = (state) => {
    // Header Title
    const headerTitle = document.getElementById('header-test-title');
    if (headerTitle) headerTitle.textContent = state.testDraft.title;

    // Validation UI
    const container = document.getElementById('validation-issues');
    if (container) {
        container.innerHTML = state.ui.issues.map(issue => `
            <div class="issue-item" style="background:${issue.severity === 'error' ? '#dc3545' : '#ffc107'}; color:white; padding:8px; margin-top:4px; border-radius:4px; cursor:pointer; font-size:12px;">
                ${issue.message}
            </div>
        `).join('');
    }

    // Structure Tree
    const tree = document.getElementById('builder-structure-tree');
    if (tree) {
        tree.innerHTML = state.testDraft.sections.map(s => `
            <div class="struct-item" style="padding:10px; border-bottom:1px solid #eee;">
                <strong>${s.title}</strong>
                <div style="font-size:11px; color:#666;">${s.parts.length} Parts</div>
            </div>
        `).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    subscribe(render);
    render(getState());

    document.addEventListener('click', e => {
        const action = e.target.closest('[data-action]')?.dataset.action;
        if (action === 'add-section') Actions.addSection();
        if (action === 'preview') Actions.previewDraft();
        if (action === 'publish') Actions.publishTest();
    });

    document.addEventListener('input', e => {
        if (e.target.dataset.path) {
            Actions.updateField(e.target.dataset.path, e.target.value);
        }
    });
});