import { EXAMS } from "../../db/db.exams.js";
import { DEFAULT_SKILL } from "../../core/rules.js";

export function getExamPlanFromSession() {
    try {
        const raw = sessionStorage.getItem('candidate_exam_components');
        if (!raw) return { components: [] };
        const components = JSON.parse(raw);
        if (!Array.isArray(components)) return { components: [] };
        
        const normalized = components.map(c => ({
            skill: c.skillSnapshot || c.skill || '',
            testId: c.testId || '',
            titleSnapshot: c.titleSnapshot || c.nameSnapshot || c.title || '',
            rules: c.rules || {}
        }));
        return { components: normalized };
    } catch (e) {
        console.warn('getExamPlanFromSession error:', e);
        return { components: [] };
    }
}

export async function getOrderedComponents() {
    try {
        const examId = sessionStorage.getItem('candidate_exam_id');
        if (examId) {
            try {
                const exam = await EXAMS.getExam(examId);
                if (exam && Array.isArray(exam.components) && exam.components.length > 0) {
                    return exam.components.map(c => ({
                        skill: c.skillSnapshot || c.skill || '',
                        testId: c.testId || '',
                        titleSnapshot: c.titleSnapshot || c.nameSnapshot || c.title || '',
                        rules: c.rules || {}
                    }));
                }
            } catch (err) {
                console.warn('Failed to fetch exam from Firestore, using session fallback:', err);
            }
        }
        const plan = getExamPlanFromSession();
        return plan.components;
    } catch (e) {
        console.error('getOrderedComponents error:', e);
        return [];
    }
}

export async function getNextSkill() {
    try {
        let progress = {};
        const rawProgress = sessionStorage.getItem('candidate_progress');
        if (rawProgress) {
            try { progress = JSON.parse(rawProgress); } catch (e) { console.warn('Failed to parse candidate_progress:', e); }
        }
        if (!progress.completedSkills) progress.completedSkills = [];
        
        const ordered = await getOrderedComponents();
        for (const component of ordered) {
            if (!progress.completedSkills.includes(component.skill)) {
                return component;
            }
        }
        return null;
    } catch (e) {
        console.error('getNextSkill error:', e);
        return null;
    }
}

export function resolveComponentFromUrlOrSession() {
    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlTestId = urlParams.get('testId');
        if (urlTestId) return { testId: decodeURIComponent(urlTestId), view: 'test' };

        const currentSkill = sessionStorage.getItem('currentSkill') || DEFAULT_SKILL;
        
        const examPlan = getExamPlanFromSession();
        
        const component = examPlan.components.find(c => {
            return c.skill === currentSkill;
        });
        
        if (component && component.testId) {
            return { testId: component.testId, view: 'test' };
        }
        
        console.warn('[resolveComponent] No component found for skill:', currentSkill);
        return { testId: null, view: 'login' };
    } catch (err) {
        console.error('resolveComponentFromUrlOrSession error:', err);
        return { testId: null, view: 'login' };
    }
}