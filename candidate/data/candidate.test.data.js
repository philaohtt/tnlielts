function normalizeTestObject(testDoc, testId) {
    if (!testDoc) throw new Error("Test document is empty");

    const normalized = {
        id: testDoc.id || testId,
        name: testDoc.name || testDoc.title || "",
        skill: testDoc.skill || "Listening",
        status: testDoc.status || "draft",
        audioMode: testDoc.audioMode || "section"
    };

    // Normalize audio fields: testAudio <-> audio
    if (testDoc.testAudio && !testDoc.audio) {
        normalized.audio = testDoc.testAudio;
        normalized.testAudio = testDoc.testAudio;
    } else if (testDoc.audio && !testDoc.testAudio) {
        normalized.audio = testDoc.audio;
        normalized.testAudio = testDoc.audio;
    } else if (testDoc.audio) {
        normalized.audio = testDoc.audio;
        normalized.testAudio = testDoc.audio;
    }

    let sectionsArray = testDoc.data || testDoc.sections || [];
    if (!Array.isArray(sectionsArray)) sectionsArray = [];

    normalized.data = sectionsArray.map((section, idx) => {
        const normalizedSection = {
            id: section.id || `section_${idx}`,
            title: section.title || section.name || `Section ${idx + 1}`,
            instructions: section.instructions || section.instructionsText || "",
            promptHtml: section.promptHtml || section.instructions || ""
        };

        // For writing tasks, ensure both field names exist
        if (section.instructionsText) {
            normalizedSection.instructionsText = section.instructionsText;
            if (!normalizedSection.instructions) normalizedSection.instructions = section.instructionsText;
        } else if (normalizedSection.instructions) {
            normalizedSection.instructionsText = normalizedSection.instructions;
        }

        if (section.prompt) normalizedSection.prompt = section.prompt;
        
        // Preserve other fields that might be needed (like index for writing)
        if (section.index !== undefined) normalizedSection.index = section.index;

        // Normalize section audio fields: sectionAudio <-> audio
        if (section.sectionAudio && !section.audio) {
            normalizedSection.audio = section.sectionAudio;
            normalizedSection.sectionAudio = section.sectionAudio;
        } else if (section.audio && !section.sectionAudio) {
            normalizedSection.audio = section.audio;
            normalizedSection.sectionAudio = section.audio;
        } else if (section.audio) {
            normalizedSection.audio = section.audio;
            normalizedSection.sectionAudio = section.audio;
        }

        let blocksArray = section.questions || section.blocks || [];
        if (!Array.isArray(blocksArray)) blocksArray = [];

        normalizedSection.questions = blocksArray.map((block) => ({
            id: block.id || `block_${Math.random()}`,
            type: String(block.type || "gap_fill").toLowerCase().trim(),
            data: block.data || {}
        }));

        return normalizedSection;
    });

    return normalized;
}

export async function loadCandidateTest(testId) {
    if (!testId) throw new Error("testId is required");

    try {
        const { DB } = await import('../../db/db.tests.js');
        let testDoc;
        if (DB.loadTest && typeof DB.loadTest === 'function') {
            testDoc = await DB.loadTest(testId);
        } else {
            testDoc = await DB.getTestWithSectionsAndBlocks(testId);
        }
        if (testDoc) return normalizeTestObject(testDoc, testId);
    } catch (err) {
        console.warn('Firestore loadCandidateTest failed, trying localStorage:', err);
    }
    
    try {
        const stored = localStorage.getItem(`ielts_candidate_test_${testId}`);
        if (stored) {
            const parsed = JSON.parse(stored);
            return normalizeTestObject(parsed, testId);
        }
    } catch (e) {
        console.warn('localStorage fallback failed:', e);
    }
    throw new Error(`Test ${testId} not found in Firestore or localStorage`);
}

export function getSkillInstructions(skill) {
    const instructions = {
        'Listening': `You will hear audio recordings of conversations and lectures. Listen carefully to all the audio, as it will be played only once. You should:\n• Ensure you are in a quiet environment with no distractions.\n• Use headphones or speakers to hear the audio clearly.\n• Read each question before the audio plays to understand what you are listening for.\n• Write your answers as you listen—do not rely on memory alone.\n• Check your spelling and grammar as these affect your score.\nYou will have time after each section to review and transfer your answers.`,
        'Reading': `You will read academic passages and answer questions about them. You should:\n• Manage your time carefully—you have limited time for three passages.\n• Scan the passage first to understand its structure and main ideas.\n• Use skimming and scanning techniques to find specific information quickly.\n• You may write on the passages but all answers must be transferred to the answer sheet.\n• Dictionaries are not permitted; rely on context to understand difficult words.\n• Check your spelling—answers must match the text exactly (unless otherwise stated).\nAfter you complete reading, you will transfer your answers to the answer sheet.`,
        'Writing': `You will complete two writing tasks. For each task, you should:\n• Read the task carefully and ensure you understand what is required.\n• Write your response directly into the text box provided.\n• Keep track of the word count requirement for each task.\n• Write clearly and use proper grammar, punctuation, and spelling.\n• Plan your response before you start writing.\n• Review and edit your work if time permits.\nAll answers are typed into the system—your handwriting is not graded.`,
        'Speaking': `You will speak with an examiner in a recorded conversation. You should:\n• Ensure your microphone is working properly and the audio is clear.\n• Speak naturally and at a normal pace.\n• Listen to each question carefully and answer fully.\n• Do not worry about making mistakes—the examiner is assessing your overall ability.\n• If you do not understand a question, you may ask the examiner to repeat it.\n• The conversation is recorded and assessed by trained examiners.\nTry to be confident and speak as naturally as possible.`,
        'Speaking (Demo)': `This is a practice session to help you become familiar with the Speaking test format. You will:\n• Speak with an examiner on a range of familiar topics.\n• Not be formally assessed, but your responses are recorded.\n• Be given feedback to help you prepare for the real test.\nRelax and use this as an opportunity to practice your speaking skills.`
    };
    return instructions[skill] || instructions['Listening'];
}