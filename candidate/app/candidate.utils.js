export function showStep(stepId) {
    const steps = ['stepCredentials', 'stepConfirm', 'stepEntering'];
    steps.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            if (id === stepId) el.classList.remove('hidden');
            else el.classList.add('hidden');
        }
    });
}

export function setError(msg) {
    const banner = document.getElementById('errorBanner');
    if (!banner) return;
    
    if (msg) {
        banner.textContent = msg;
        banner.style.display = 'block';
        banner.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
        banner.style.display = 'none';
        banner.textContent = '';
    }
}

export function clearError() {
    setError(null);
}

export function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    const s = String(str);
    return s.replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Convert technical error messages to user-friendly phrasing
 * @param {string} technicalError - The original technical error message
 * @param {string} errorCode - Optional error code for logging
 * @returns {string} User-friendly error message
 */
export function getUserFriendlyError(technicalError, errorCode = null) {
    // Log technical error for debugging
    if (errorCode) {
        console.error(`[Error ${errorCode}]`, technicalError);
    } else {
        console.error('[Error]', technicalError);
    }

    const errorLower = String(technicalError || '').toLowerCase();

    // ID/Credential not found errors
    if (errorLower.includes('not found') || 
        errorLower.includes('no match') || 
        errorLower.includes('no matching candidate') ||
        errorLower.includes('candidate id not found')) {
        return "We couldn't find your details. Please check and try again.";
    }

    // Session/Schedule not open errors
    if (errorLower.includes('session not open') || 
        errorLower.includes('not assigned to any schedule') ||
        errorLower.includes('no valid schedule')) {
        return "Your test hasn't started yet. Please wait for the proctor.";
    }

    // Network/Connection errors
    if (errorLower.includes('connection') || 
        errorLower.includes('network') ||
        errorLower.includes('fetch') ||
        errorLower.includes('timeout')) {
        return "Connection issue. Your progress is safe.";
    }

    // System/Database errors
    if (errorLower.includes('system error') || 
        errorLower.includes('database') ||
        errorLower.includes('firestore')) {
        return "We're having technical difficulties. Please contact the proctor.";
    }

    // Data corruption
    if (errorLower.includes('corruption') || 
        errorLower.includes('invalid data') ||
        errorLower.includes('parsing')) {
        return "Something went wrong with your session. Please log in again.";
    }

    // Session expired
    if (errorLower.includes('session expired') || 
        errorLower.includes('expired')) {
        return "Your session has ended. Please log in again.";
    }

    // Missing credentials
    if (errorLower.includes('missing') || 
        errorLower.includes('please enter')) {
        return technicalError; // These are already user-friendly
    }

    // Submission errors
    if (errorLower.includes('submission failed') ||
        errorLower.includes('failed to submit')) {
        return "We couldn't submit your test. Please try again.";
    }

    // Default fallback
    return "Something went wrong. Please contact the proctor for help.";
}

export function calculateWordCount(text) {
    if (!text) return 0;
    return text.trim().split(/\s+/).filter(word => word.length > 0).length;
}