// candidate.writing.retrieve.js
// Retrieves and displays candidate writing submissions from Firestore
// Usage: Import and call showCandidateWritings(containerElement, candidateId, testId)

import { db } from '../core/firebase.js';

/**
 * Fetches writing answers for a candidate's attempt from Firestore.
 * @param {string} candidateId
 * @param {string} testId
 * @returns {Promise<Object|null>} Writing answers or null if not found
 */
export async function fetchCandidateWriting(candidateId, testId) {
  const attemptId = `${candidateId}_${testId}`;
  const docRef = db.collection('attempts').doc(attemptId);
  const doc = await docRef.get();
  if (!doc.exists) return null;
  const data = doc.data();
  return data?.skills?.writing?.answers?.writing || null;
}

/**
 * Renders writing answers into a container element.
 * @param {HTMLElement} container
 * @param {Object} writingAnswers
 */
export function renderWritingAnswers(container, writingAnswers) {
  if (!writingAnswers) {
    container.innerHTML = '<em>No writing submissions found.</em>';
    return;
  }
  let html = '<h3>Writing Submissions</h3><ol>';
  for (const [taskId, answer] of Object.entries(writingAnswers)) {
    html += `<li><strong>Task ${taskId}:</strong><br><pre>${escapeHtml(answer)}</pre></li>`;
  }
  html += '</ol>';
  container.innerHTML = html;
}

// Utility to escape HTML for safe rendering
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Main function to fetch and show candidate writings in a container.
 * @param {HTMLElement} container
 * @param {string} candidateId
 * @param {string} testId
 */
export async function showCandidateWritings(container, candidateId, testId) {
  container.innerHTML = 'Loading...';
  const writingAnswers = await fetchCandidateWriting(candidateId, testId);
  renderWritingAnswers(container, writingAnswers);
}
