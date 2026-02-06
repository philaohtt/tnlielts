// FILE: db.exams.js
import { db } from "../core/firebase.js";
import { 
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, 
    query, orderBy, serverTimestamp, where 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const EXAMS_COL = 'exams';
const TESTS_COL = 'tests';

export const EXAMS = {
    /**
     * Lists all exams ordered by modification date.
     */
    async listExams() {
        try {
            const q = query(collection(db, EXAMS_COL), orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error listing exams:", e);
            throw e;
        }
    },

    /**
     * Creates a new exam draft.
     */
    async createExam({ title, components, rules } = {}) {
        try {
            const examData = {
                title: title || 'Untitled Exam',
                status: "draft",
                rules: rules || { 
                    timeLimitMin: null, 
                    attemptsAllowed: null 
                },
                audioPlan: {
                    gapBetweenAudiosSec: 0,
                    extraAfterAudioSec: 600  // 10 minutes default
                },
                components: Array.isArray(components) ? components : [],
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // --- Deterministic exam ID generation ---
            const now = new Date();
            const yy = String(now.getFullYear()).slice(-2);

            // Query existing exams for the current year
            const idPattern = new RegExp(`^exam_${yy}_(0*[0-9]+)$`);
            const allExams = await getDocs(collection(db, EXAMS_COL));
            
            let sameYearCount = 0;
            allExams.docs.forEach(d => {
                if (typeof d.id === 'string' && idPattern.test(d.id)) {
                    sameYearCount++;
                }
            });

            const seqNum = sameYearCount + 1;
            const seqStr = String(seqNum).padStart(2, '0'); // 01, 02, 03...
            const examId = `exam_${yy}_${seqStr}`;

            // Persist exam using setDoc with deterministic ID
            const examRef = doc(db, EXAMS_COL, examId);
            await setDoc(examRef, examData);
            
            return examId;
        } catch (e) {
            console.error("Error creating exam:", e);
            throw e;
        }
    },

    /**
     * Fetches a specific exam by ID.
     */
    async getExam(examId) {
        try {
            const docRef = doc(db, EXAMS_COL, examId);
            const snap = await getDoc(docRef);
            if (!snap.exists()) return null;
            return { id: snap.id, ...snap.data() };
        } catch (e) {
            console.error("Error getting exam:", e);
            throw e;
        }
    },

    /**
     * Updates an exam with a patch object.
     */
    async updateExam(examId, patch) {
        try {
            const docRef = doc(db, EXAMS_COL, examId);
            const data = { 
                ...patch, 
                updatedAt: serverTimestamp() 
            };
            await updateDoc(docRef, data);
            return true;
        } catch (e) {
            console.error("Error updating exam:", e);
            throw e;
        }
    },

    /**
     * Specifically updates the status of an exam.
     */
    async setExamStatus(examId, status) {
        const allowed = ['draft', 'published', 'closed'];
        if (!allowed.includes(status)) throw new Error("Invalid status");
        return this.updateExam(examId, { status });
    },

    /**
     * Validates an exam object.
     * @param {object} exam The exam object to validate.
     * @returns {object} { isValid: boolean, errors: string[], warnings: string[] }
     */
    validateExam(exam) {
        const errors = [];
        const warnings = [];

        // Check exam has a non-empty title
        if (!exam || !exam.title || typeof exam.title !== 'string' || !exam.title.trim()) {
            errors.push('Exam must have a non-empty title');
        }

        // Check exam has at least 1 component
        const components = exam?.components || [];
        if (!Array.isArray(components) || components.length === 0) {
            errors.push('Exam must have at least one component');
        }

        // Validate each component
        components.forEach((comp, idx) => {
            const prefix = `Component ${idx + 1}`;

            // Check testId exists
            if (!comp.testId || typeof comp.testId !== 'string' || !comp.testId.trim()) {
                errors.push(`${prefix}: Missing or invalid testId`);
            }

            // Check attempts if field exists
            if (typeof comp.attempts !== 'undefined') {
                const att = parseInt(comp.attempts);
                if (!Number.isFinite(att) || att < 1) {
                    errors.push(`${prefix}: attempts must be a positive number`);
                }
            }

            // Check timeLimitMin if field exists
            if (typeof comp.timeLimitMin !== 'undefined') {
                const time = parseInt(comp.timeLimitMin);
                if (!Number.isFinite(time) || time < 1) {
                    errors.push(`${prefix}: timeLimitMin must be a positive number`);
                }
            }

            // Warn if snapshot is missing
            if (!comp.titleSnapshot && !comp.nameSnapshot) {
                warnings.push(`${prefix}: Missing test title snapshot (may need refresh)`);
            }
            if (!comp.skillSnapshot) {
                warnings.push(`${prefix}: Missing skill snapshot (may need refresh)`);
            }

            // Warn if snapshot might be stale (test updated after component snapshot)
            if (comp.updatedAtSnapshot && comp.testUpdatedAt) {
                try {
                    const snapTime = new Date(comp.updatedAtSnapshot).getTime();
                    const testTime = new Date(comp.testUpdatedAt).getTime();
                    if (testTime > snapTime) {
                        warnings.push(`${prefix}: Snapshot may be stale (test updated more recently)`);
                    }
                } catch (e) {
                    // ignore date parsing errors
                }
            }
        });

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    },

    /**
     * Refreshes a component's snapshot by loading the linked test and updating metadata.
     * @param {string} examId The exam document ID.
     * @param {number|string} componentIdOrIndex Component ID or array index.
     * @returns {Promise<object>} { success: boolean, updated?: object, error?: string }
     */
    async refreshComponentSnapshot(examId, componentIdOrIndex) {
        try {
            // Load the exam
            const examRef = doc(db, EXAMS_COL, examId);
            const examSnap = await getDoc(examRef);
            
            if (!examSnap.exists()) {
                return { success: false, error: 'Exam not found' };
            }

            const examData = examSnap.data();
            const components = examData.components || [];

            // Find component by index or id
            let componentIndex = -1;
            if (typeof componentIdOrIndex === 'number') {
                componentIndex = componentIdOrIndex;
            } else {
                componentIndex = components.findIndex(c => c.id === componentIdOrIndex);
            }

            if (componentIndex < 0 || componentIndex >= components.length) {
                return { success: false, error: 'Component not found' };
            }

            const component = components[componentIndex];
            const testId = component.testId;

            if (!testId) {
                return { success: false, error: 'Component has no testId' };
            }

            // Load the linked test document
            const testRef = doc(db, TESTS_COL, testId);
            const testSnap = await getDoc(testRef);

            if (!testSnap.exists()) {
                return { success: false, error: 'Linked test not found' };
            }

            const testData = testSnap.data();

            // Update component snapshot fields
            const updatedComponent = {
                ...component,
                titleSnapshot: testData.name || testData.title || 'Untitled Test',
                nameSnapshot: testData.name || testData.title || 'Untitled Test',
                skillSnapshot: testData.skill || 'Listening',
                updatedAtSnapshot: new Date().toISOString(),
                testUpdatedAt: testData.updatedAt?.toDate?.()?.toISOString() || testData.updatedAt || new Date().toISOString()
            };

            // Update the components array
            const updatedComponents = [...components];
            updatedComponents[componentIndex] = updatedComponent;

            // Write back to Firestore
            await updateDoc(examRef, {
                components: updatedComponents,
                updatedAt: serverTimestamp()
            });

            return { 
                success: true, 
                updated: updatedComponent 
            };

        } catch (e) {
            console.error("Error refreshing component snapshot:", e);
            return { 
                success: false, 
                error: e.message || 'Unknown error' 
            };
        }
    }
};