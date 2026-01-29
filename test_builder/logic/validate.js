import { getRuleset } from './rules.js';

export const validateTestSpec = (test, mode = 'draft') => {
    const issues = [];
    const rules = getRuleset(test.skill);

    if (!test.title || test.title.length < 5) {
        issues.push({ severity: 'BLOCKER', message: "Title is too short.", path: 'title', ui: { focus: 'STRUCTURE' } });
    }

    if (mode === 'publish' && test.sections.length !== rules.requiredSections) {
        issues.push({ severity: 'BLOCKER', message: `IELTS ${test.skill} must have ${rules.requiredSections} sections.`, path: 'sections', ui: { focus: 'STRUCTURE' } });
    }

    test.sections.forEach((s, sIdx) => {
        if (s.parts.length === 0) {
            issues.push({ severity: 'BLOCKER', message: `Section ${sIdx + 1} is empty.`, path: { sectionId: s.id }, ui: { focus: 'STRUCTURE' } });
        }
    });

    return {
        ok: !issues.some(i => i.severity === 'BLOCKER'),
        issues: issues.map(i => ({ ...i, severity: i.severity === 'BLOCKER' ? 'error' : 'warning' }))
    };
};