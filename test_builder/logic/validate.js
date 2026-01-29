export const validateTestSpec = (testSpec, mode = "draft") => {
    const issues = [];
    if (mode === "publish") {
        if (!testSpec.title || testSpec.title.length < 5) {
            issues.push({ severity: "error", code: "NO_TITLE", path: "title", message: "A descriptive title is required for publishing." });
        }
        if (!testSpec.sections || testSpec.sections.length === 0) {
            issues.push({ severity: "error", code: "NO_SECTIONS", path: "sections", message: "Test must have at least one section to be published." });
        }
    }
    
    (testSpec.sections || []).forEach((s, sIdx) => {
        if ((!s.parts || s.parts.length === 0) && mode === "publish") {
            issues.push({ severity: "warning", code: "EMPTY_SECTION", path: `sections.${sIdx}`, message: `Section ${sIdx + 1} has no parts.` });
        }
    });

    return { ok: !issues.some(i => i.severity === "error"), issues };
};