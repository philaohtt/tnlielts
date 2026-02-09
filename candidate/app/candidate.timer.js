import { doc, getDoc, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { db } from "../../core/firebase.js";

let timerInterval = null;
let timerDisplay = null;

let scheduleUnsub = null;
let rosterUnsub = null;

let scheduleData = null;
let rosterData = null;

let onTimeUpCallback = null;

let currentSkill = null;
let sessionId = null;
let rosterId = null;

export function initTimer({ sessionId: sid, rosterId: rid, skill, onTimeUp } = {}) {
  timerDisplay = document.getElementById("timerDisplay");
  if (onTimeUp) onTimeUpCallback = onTimeUp;

  stopTimer();

  sessionId = sid || null;
  rosterId = rid || null;
  currentSkill = skill || null;

  scheduleData = null;
  rosterData = null;

  if (!sessionId) return;

  const scheduleRef = doc(db, "schedules", sessionId);
  getDoc(scheduleRef).then(s => { if (s.exists()) scheduleData = s.data(); });
  scheduleUnsub = onSnapshot(scheduleRef, (s) => { if (s.exists()) scheduleData = s.data(); });

  if (rosterId) {
    const rosterRef = doc(db, "schedules", sessionId, "roster", rosterId);
    getDoc(rosterRef).then(s => { if (s.exists()) rosterData = s.data(); });
    rosterUnsub = onSnapshot(rosterRef, (s) => { if (s.exists()) rosterData = s.data(); });
  }

  timerInterval = setInterval(updateDisplay, 500);
}

export function setTimerSkill(skill) {
  currentSkill = skill || null;
}

export function stopTimer() {
  if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
  if (scheduleUnsub) { scheduleUnsub(); scheduleUnsub = null; }
  if (rosterUnsub) { rosterUnsub(); rosterUnsub = null; }
}

export function hideTimer() {
  stopTimer();
  if (timerDisplay) timerDisplay.style.display = "none";
}

function toMs(ts) {
  if (!ts) return null;
  if (typeof ts.toMillis === "function") return ts.toMillis();
  if (ts._seconds) return ts._seconds * 1000;
  return null;
}

function getSkillDurationMs() {
  if (!scheduleData || !currentSkill) return null;
  const comps = Array.isArray(scheduleData.examComponentsSnapshot) ? scheduleData.examComponentsSnapshot : [];
  const comp = comps.find(c =>
    String(c.skillSnapshot || c.skill || "").toLowerCase() === String(currentSkill).toLowerCase()
  );
  const min = comp?.timeLimitMin;
  if (!min) return null;
  return Number(min) * 60 * 1000;
}

function getSkillStartedAtMs() {
  if (!rosterData || !currentSkill) return null;
  const st = rosterData.skillTiming || {};
  const startedAt = st[currentSkill]?.startedAt;
  return toMs(startedAt);
}

function computeRemaining(nowMs = Date.now()) {
  const durationMs = getSkillDurationMs();
  const startMs = getSkillStartedAtMs();
  if (!durationMs || !startMs) return null;

  // optional: schedule-wide pause support if you added these fields
  const paused = !!scheduleData?.paused;
  const pausedTotalMs = Number(scheduleData?.pausedTotalMs || 0);
  const pauseStartedAtMs = toMs(scheduleData?.pauseStartedAt);

  if (paused && pauseStartedAtMs) {
    nowMs = pauseStartedAtMs; // freeze while paused
  }

  const elapsed = nowMs - startMs - pausedTotalMs;
  const remainingMs = durationMs - elapsed;

  return Math.max(0, Math.round(remainingMs / 1000));
}

function updateDisplay() {
  if (!timerDisplay) return;

  const remaining = computeRemaining(Date.now());

  if (remaining == null) {
    timerDisplay.textContent = "--:--";
    timerDisplay.style.display = "block";
    timerDisplay.classList.remove("warning", "danger");
    return;
  }

  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  timerDisplay.textContent = `${minutes}:${String(seconds).padStart(2, "0")}`;
  timerDisplay.style.display = "block";

  timerDisplay.classList.remove("warning", "danger");
  if (remaining <= 60) timerDisplay.classList.add("danger");
  else if (remaining <= 300) timerDisplay.classList.add("warning");

  if (remaining <= 0) {
    stopTimer();
    timerDisplay.textContent = "TIME UP";
    timerDisplay.classList.add("danger");
    if (typeof onTimeUpCallback === "function") onTimeUpCallback();
  }
}
