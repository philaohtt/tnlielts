import { db } from "../core/firebase.js";
import { 
    collection, doc, getDoc, getDocs, addDoc, setDoc, updateDoc, deleteDoc, 
    query, orderBy, where, serverTimestamp, writeBatch, runTransaction 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage, ref as sRef, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const TESTS_COL = 'tests';
const SECTIONS_SUB = 'sections';
const BLOCKS_SUB = 'blocks';

function safeFileName(name) {
    if (!name) return 'file';
    // keep extension, lowercase, spaces->_, remove unsafe chars except . _ -
    const parts = name.split('.');
    if (parts.length === 1) {
        return parts[0].toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
    }
    const ext = parts.pop();
    const base = parts.join('.');
    const safeBase = base.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9._-]/g, '');
    const safeExt = ext.toLowerCase().replace(/[^a-z0-9]/g, '');
    return `${safeBase}.${safeExt}`;
}

/**
 * Deep clones an object using JSON serialization.
 * Falls back to returning the original if cloning fails.
 */
function deepClone(obj) {
    try {
        return JSON.parse(JSON.stringify(obj));
    } catch (e) {
        console.warn('deepClone failed, returning original:', e);
        return obj;
    }
}

export const DB = {
    /**
     * Lists all tests ordered by modification date.
     */
    async listTests() {
        try {
            const q = query(collection(db, TESTS_COL), orderBy('updatedAt', 'desc'));
            const snapshot = await getDocs(q);
            return snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (e) {
            console.error("Error listing tests:", e);
            throw e;
        }
    },

    /**
     * Creates a new test and initializes its sections.
     * Returns raw Firestore data without normalization.
     */
    async createTest(payload = {}) {
        try {
            // support legacy destructured call signature as well
            const p = (typeof payload === 'object' && payload !== null) ? payload : {};

            const rawName = p.name;
            const title = p.title;
            const testType = p.testType;
            const rawAudioMode = p.audioMode;
            const totalTimeMin = p.totalTimeMin;
            const totalSections = p.totalSections;
            const rawSkill = p.skill;

            // canonical name field: prefer name, fallback to title
            const name = (rawName && String(rawName).trim()) ? String(rawName).trim()
                        : (title && String(title).trim()) ? String(title).trim()
                        : 'Untitled Test';

            // Use skill as-is, default to 'Listening' only if not provided
            const skill = (rawSkill && String(rawSkill).trim()) ? String(rawSkill).trim() : 'Listening';

            const safeSections = Math.max(1, parseInt(totalSections) || 1); // Ensure at least 1 section

            // Prebuild deterministic section IDs for subcollection only
            const sectionsSeed = [];
            const skillSlug = String(skill).toLowerCase().replace(/\s+/g, '_');
            for (let i = 0; i < safeSections; i++) {
                const sectionId = `sec_${skillSlug}_${i + 1}`;
                sectionsSeed.push({
                    id: sectionId,
                    index: i,
                    title: `Section ${i + 1}`,
                    instructions: ''
                });
            }

            // Build testData with only provided fields
            const testData = {
                name,
                testType,
                skill,
                totalTimeMin: parseInt(totalTimeMin) || 30,
                totalSections: safeSections,
                status: "draft",
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            if (typeof rawAudioMode !== 'undefined') {
                testData.audioMode = rawAudioMode;
            }

            // --- Deterministic test ID generation ---
            const now = new Date();
            const yy = String(now.getFullYear()).slice(-2);
            // skillSlug already computed above

            // Query existing tests for this skill
            const skillQuery = query(collection(db, TESTS_COL), where('skill', '==', skill));
            const skillSnap = await getDocs(skillQuery);

            // Count existing tests with the same skill/year prefix in ID
            const idPattern = new RegExp(`^test_${skillSlug}_${yy}_(0*[0-9]+)$`);
            let sameYearCount = 0;
            skillSnap.docs.forEach(d => {
                if (typeof d.id === 'string' && idPattern.test(d.id)) sameYearCount++;
            });

            const seqNum = sameYearCount + 1;
            const seqStr = String(seqNum).padStart(2, '0'); // 01, 02, 03...
            const testId = `test_${skillSlug}_${yy}_${seqStr}`;

            // Persist test using setDoc with deterministic ID (no addDoc)
            const testRef = doc(db, TESTS_COL, testId);
            await setDoc(testRef, testData);

            // Create deterministic section IDs: sec_<skill>_<index>
            const batch = writeBatch(db);
            sectionsSeed.forEach((section) => {
                const sectionRef = doc(db, TESTS_COL, testRef.id, SECTIONS_SUB, section.id);
                batch.set(sectionRef, {
                    index: section.index,
                    title: section.title,
                    instructions: section.instructions,
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
            });

            await batch.commit();
            return testRef.id;
        } catch (e) {
            console.error("Error creating test:", e);
            throw e;
        }
    },

    /**
     * Loads a full test object including sections and question blocks.
     * Returns raw Firestore data without normalization.
     */
    async loadTest(testId) {
        try {
            const testRef = doc(db, TESTS_COL, testId);
            const testSnap = await getDoc(testRef);
            
            if (!testSnap.exists()) throw new Error("Test not found");

            const testData = { id: testSnap.id, ...testSnap.data() };

            // Normalize testAudio → audio for UI compatibility
            if (testData.testAudio) {
                testData.audio = testData.testAudio;
            }

            // Load Sections
            const secQuery = query(collection(testRef, SECTIONS_SUB), orderBy('index', 'asc'));
            const secSnap = await getDocs(secQuery);
            
            const sections = await Promise.all(secSnap.docs.map(async (sDoc) => {
                const sData = { id: sDoc.id, ...sDoc.data(), questions: [] };
                
                // Normalize sectionAudio → audio for UI compatibility
                if (sData.sectionAudio) {
                    sData.audio = sData.sectionAudio;
                }
                
                // Load Blocks for this section
                const blocksQuery = query(collection(sDoc.ref, BLOCKS_SUB), orderBy('order', 'asc'));
                const blocksSnap = await getDocs(blocksQuery);
                
                sData.questions = blocksSnap.docs.map(bDoc => ({
                    id: bDoc.id,
                    ...bDoc.data()
                }));
                
                return sData;
            }));

            // Attach sections to data property
            testData.data = sections || []; 
            testData.sections = sections || []; 

            return testData;
        } catch (e) {
            console.error("Error loading test:", e);
            throw e;
        }
    },

    /**
     * Compatibility wrapper for loadTest that ensures Writing section fields are present.
     * Returns { id, ...testDocData, data: [ {id, title, instructions, instructionsText, promptHtml, questions:[]} ] }
     */
    async getTestWithSectionsAndBlocks(testId) {
        try {
            const test = await this.loadTest(testId);
            return test;
        } catch (e) {
            console.error("Error in getTestWithSectionsAndBlocks:", e);
            throw e;
        }
    },

    /**
     * Updates section metadata (title, instructions).
     */
    async updateSection(testId, sectionId, data) {
        try {
            const ref = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
            await updateDoc(ref, { 
                ...data, 
                updatedAt: serverTimestamp() 
            });
            await updateDoc(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
        } catch (e) {
            console.error("Error updating section:", e);
            throw e;
        }
    },

    /**
     * Updates specific section fields including Writing-specific ones.
     * Compatible wrapper that allows updating title, instructions, instructionsText, promptHtml.
     */
    async updateSectionFields(testId, sectionId, partial) {
        try {
            const allowedFields = ['title', 'instructions', 'instructionsText', 'promptHtml'];
            const updateData = {};
            
            for (const key of allowedFields) {
                if (key in partial) {
                    updateData[key] = partial[key];
                }
            }
            
            if (Object.keys(updateData).length === 0) {
                return; // Nothing to update
            }
            
            await this.updateSection(testId, sectionId, updateData);
        } catch (e) {
            console.error("Error in updateSectionFields:", e);
            throw e;
        }
    },

    /**
     * Adds a new block to a section.
     */
    async addBlock(testId, sectionId, type, defaultData) {
        try {
            const sectionRef = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
            const blocksCol = collection(sectionRef, BLOCKS_SUB);
            
            // Get section data to retrieve the section index
            const sectionSnap = await getDoc(sectionRef);
            if (!sectionSnap.exists()) {
                throw new Error(`Section ${sectionId} not found`);
            }
            const sectionData = sectionSnap.data();
            const sectionIndex = sectionData.index !== undefined ? sectionData.index + 1 : 1;
            
            const q = query(blocksCol);
            const snap = await getDocs(q);
            const order = snap.size;
            
            // Generate deterministic block ID: blk_<type>_<sectionIndex>_<index>
            const blockIndex = order + 1;
            const blockId = `blk_${type}_${sectionIndex}_${blockIndex}`;

            const blockData = {
                type,
                order,
                data: defaultData,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            // Use setDoc with deterministic ID instead of addDoc
            const blockRef = doc(blocksCol, blockId);
            await setDoc(blockRef, blockData);
            await updateDoc(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
            return blockId;
        } catch (e) {
            console.error("Error adding block:", e);
            throw e;
        }
    },

    /**
     * Updates just the 'data' field of a block.
     */
    async updateBlockData(testId, sectionId, blockId, data) {
        try {
            const ref = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId, BLOCKS_SUB, blockId);
            await updateDoc(ref, { 
                data, 
                updatedAt: serverTimestamp() 
            });
            await updateDoc(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
        } catch (e) {
            console.error("Error updating block:", e);
            throw e;
        }
    },

    /**
     * Deletes a block and re-sequences the order of remaining blocks.
     */
    async deleteBlock(testId, sectionId, blockId) {
        try {
            const sectionRef = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
            const blockRef = doc(sectionRef, BLOCKS_SUB, blockId);
            
            await deleteDoc(blockRef);

            const q = query(collection(sectionRef, BLOCKS_SUB), orderBy('order', 'asc'));
            const snap = await getDocs(q);
            
            const batch = writeBatch(db);
            snap.docs.forEach((doc, index) => {
                if (doc.data().order !== index) {
                    batch.update(doc.ref, { order: index });
                }
            });
            
            await batch.commit();
            await updateDoc(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
        } catch (e) {
            console.error("Error deleting block:", e);
            throw e;
        }
    },

    /**
     * Moves a block up or down by swapping orders with its neighbor.
     */
    async moveBlock(testId, sectionId, blockId, direction) {
        try {
            await runTransaction(db, async (transaction) => {
                const sectionRef = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
                const blockRef = doc(sectionRef, BLOCKS_SUB, blockId);
                const blockSnap = await transaction.get(blockRef);
                
                if (!blockSnap.exists()) throw "Block does not exist";
                
                const currentOrder = blockSnap.data().order;
                const swapOrder = direction === 'up' ? currentOrder - 1 : currentOrder + 1;
                
                if (swapOrder < 0) return; 
                
                const q = query(
                    collection(sectionRef, BLOCKS_SUB), 
                    where('order', '==', swapOrder)
                );
                const neighborSnap = await getDocs(q);
                
                if (neighborSnap.empty) return; 
                
                const neighborDoc = neighborSnap.docs[0];
                
                transaction.update(blockRef, { order: swapOrder });
                transaction.update(neighborDoc.ref, { order: currentOrder });
                transaction.update(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
            });
        } catch (e) {
            console.error("Error moving block:", e);
            throw e;
        }
    },

    /**
     * Compatibility wrapper for moveBlock with stable naming for editors.
     * Reorders a block by moving it up or down.
     */
    async reorderBlock(testId, sectionId, blockId, direction) {
        try {
            await this.moveBlock(testId, sectionId, blockId, direction);
        } catch (e) {
            console.error("Error in reorderBlock:", e);
            throw e;
        }
    },

    /**
     * Duplicates a block.
     */
    async duplicateBlock(testId, sectionId, blockId) {
        try {
            const sectionRef = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
            const blocksRef = collection(sectionRef, BLOCKS_SUB);

            // Get section data to retrieve the section index
            const sectionSnap = await getDoc(sectionRef);
            if (!sectionSnap.exists()) {
                throw new Error(`Section ${sectionId} not found`);
            }
            const sectionData = sectionSnap.data();
            const sectionIndex = sectionData.index !== undefined ? sectionData.index + 1 : 1;

            await runTransaction(db, async (transaction) => {
                const q = query(blocksRef, orderBy('order', 'asc'));
                const snap = await getDocs(q);
                
                const blocks = snap.docs.map(d => ({ id: d.id, ...d.data(), ref: d.ref }));
                const sourceBlock = blocks.find(b => b.id === blockId);
                
                if (!sourceBlock) throw "Source block not found";

                const newOrder = sourceBlock.order + 1;
                
                for (let i = blocks.length - 1; i >= 0; i--) {
                    const b = blocks[i];
                    if (b.order >= newOrder) {
                        transaction.update(b.ref, { order: b.order + 1 });
                    }
                }

                // Generate deterministic block ID: blk_<type>_<sectionIndex>_<nextIndex>
                // Find the highest index for this type and section
                const typePattern = new RegExp(`^blk_${sourceBlock.type}_${sectionIndex}_(\\d+)$`);
                let maxIndex = 0;
                blocks.forEach(b => {
                    const match = b.id.match(typePattern);
                    if (match) {
                        maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
                    }
                });
                const newBlockId = `blk_${sourceBlock.type}_${sectionIndex}_${maxIndex + 1}`;

                const newRef = doc(blocksRef, newBlockId);
                transaction.set(newRef, {
                    type: sourceBlock.type,
                    order: newOrder,
                    data: deepClone(sourceBlock.data),
                    createdAt: serverTimestamp(),
                    updatedAt: serverTimestamp()
                });
                
                transaction.update(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });
            });
        } catch (e) {
            console.error("Error duplicating block:", e);
            throw e;
        }
    },

    /**
     * Upload whole-test audio to Firebase Storage and record metadata in Firestore.
     * Returns { url, name } on success.
     */
    async uploadTestAudio(testId, file) {
        try {
            const storage = getStorage();
            const name = safeFileName(file.name || 'audio.mp3');
            const path = `tests/${testId}/audio/${name}`;
            const ref = sRef(storage, path);
            await uploadBytes(ref, file);
            const url = await getDownloadURL(ref);

            // write metadata to test document
            await updateDoc(doc(db, TESTS_COL, testId), {
                testAudio: { url, name },
                updatedAt: serverTimestamp()
            });

            return { url, name };
        } catch (e) {
            console.error("Error uploading test audio:", e);
            throw e;
        }
    },

    /**
     * Upload section-level audio to Storage and update section document with metadata.
     * Returns { url, name } on success.
     */
    async uploadSectionAudio(testId, sectionId, file) {
        try {
            const storage = getStorage();
            const name = safeFileName(file.name || 'audio.mp3');
            const path = `tests/${testId}/sections/${sectionId}/audio/${name}`;
            const ref = sRef(storage, path);
            await uploadBytes(ref, file);
            const url = await getDownloadURL(ref);

            // write metadata to section document
            const sectionRef = doc(db, TESTS_COL, testId, SECTIONS_SUB, sectionId);
            await updateDoc(sectionRef, {
                sectionAudio: { url, name },
                updatedAt: serverTimestamp()
            });

            // touch test updatedAt as well
            await updateDoc(doc(db, TESTS_COL, testId), { updatedAt: serverTimestamp() });

            return { url, name };
        } catch (e) {
            console.error("Error uploading section audio:", e);
            throw e;
        }
    },

    async commitReturnFromEditIfAny() {
        const status = sessionStorage.getItem('sys_editing_status');
        if (status !== 'saved') return { committed: false };

        try {
            const rawTarget = sessionStorage.getItem('sys_editing_target');
            const rawData = sessionStorage.getItem('sys_editing_data');
            
            if (!rawTarget || !rawData) return { committed: false };

            const target = JSON.parse(rawTarget);
            const data = JSON.parse(rawData);

            await this.updateBlockData(target.testId, target.sectionId, target.blockId, data);

            sessionStorage.removeItem('sys_editing_status');
            sessionStorage.removeItem('sys_editing_target');
            sessionStorage.removeItem('sys_editing_data');

            return { committed: true, testId: target.testId };
        } catch (e) {
            console.error("Error committing edit:", e);
            sessionStorage.removeItem('sys_editing_status');
            return { committed: false };
        }
    },

    /**
     * Delete a test and all its subcollections (sections -> blocks).
     */
    async deleteTest(testId) {
        try {
            const testRef = doc(db, TESTS_COL, testId);

            // Load all sections
            const secSnap = await getDocs(query(collection(testRef, SECTIONS_SUB), orderBy('index', 'asc')));

            // For each section, delete its blocks and then the section in a batch.
            for (const sDoc of secSnap.docs) {
                const sectionRef = sDoc.ref;
                const blocksSnap = await getDocs(collection(sectionRef, BLOCKS_SUB));

                // Use a batch per section to avoid exceeding limits
                const batch = writeBatch(db);
                blocksSnap.docs.forEach(b => batch.delete(b.ref));
                batch.delete(sectionRef);
                await batch.commit();
            }

            // Finally delete the test document itself
            await deleteDoc(testRef);
        } catch (e) {
            console.error("Error deleting test:", e);
            throw e;
        }
    },

    // --- New status helpers ---
    async publishTest(testId) {
        try {
            await updateDoc(doc(db, TESTS_COL, testId), {
                status: 'published',
                publishedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { ok: true };
        } catch (e) {
            console.error('publishTest err', e);
            throw e;
        }
    },

    async unpublishTest(testId) {
        try {
            await updateDoc(doc(db, TESTS_COL, testId), {
                status: 'draft',
                unpublishedAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            return { ok: true };
        } catch (e) {
            console.error('unpublishTest err', e);
            throw e;
        }
    },

    async setTestStatus(testId, status) {
        try {
            const allowed = ['draft', 'ready', 'published'];
            const s = allowed.includes(status) ? status : 'draft';
            await updateDoc(doc(db, TESTS_COL, testId), {
                status: s,
                updatedAt: serverTimestamp()
            });
            return { ok: true };
        } catch (e) {
            console.error('setTestStatus err', e);
            throw e;
        }
    },
};