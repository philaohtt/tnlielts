import { validatePublish } from './validate.js';

export const deepFreeze = (obj) => {
    Object.freeze(obj);
    Object.getOwnPropertyNames(obj).forEach(prop => {
        if (obj.hasOwnProperty(prop) && obj[prop] !== null && (typeof obj[prop] === "object") && !Object.isFrozen(obj[prop])) {
            deepFreeze(obj[prop]);
        }
    });
    return obj;
};

/**
 * Creates a read-only snapshot for publishing.
 * MUST have 0 Blockers to proceed.
 */
export const publishSnapshot = (draft) => {
    const issues = validatePublish(draft);
    const hasBlockers = issues.some(i => i.severity === 'BLOCKER');

    if (hasBlockers) {
        throw new Error("PUBLISH_BLOCKED: Cannot publish a test with active blockers.");
    }

    // Return a deep-frozen clone
    return deepFreeze(JSON.parse(JSON.stringify(draft)));
};

/**
 * Drafts can be saved with warnings or blockers,
 * allowing the user to pause work.
 */
export const saveDraftState = (draft) => {
    return JSON.parse(JSON.stringify(draft));
};