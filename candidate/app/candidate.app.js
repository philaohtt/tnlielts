// Main entry point for Candidate Entry application
// Re-exports authentication functions for use in Candidate_Entry.html

export { 
    switchLoginMethod, 
    handleCredentialsSubmit, 
    handleConfirmEnter 
} from '../auth/candidate.auth.controller.js';

// Optional: Add an init function if needed for initialization logic
export function init() {
    // Initialization logic can go here if needed in the future
}
