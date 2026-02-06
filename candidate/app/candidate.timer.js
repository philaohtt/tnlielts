// Timer Controller for Listening, Reading, and Writing tests

let timerInterval = null;
let remainingSeconds = 0;
let isRunning = false;
let timerDisplay = null;

export function initTimer() {
    timerDisplay = document.getElementById('timerDisplay');
}

export function startTimer(durationMinutes) {
    if (!durationMinutes || durationMinutes <= 0) {
        hideTimer();
        return;
    }
    
    stopTimer();
    
    remainingSeconds = durationMinutes * 60;
    isRunning = true;
    
    if (timerDisplay) {
        timerDisplay.style.display = 'block';
        updateDisplay();
    }
    
    timerInterval = setInterval(() => {
        if (remainingSeconds > 0) {
            remainingSeconds--;
            updateDisplay();
        } else {
            stopTimer();
            onTimeUp();
        }
    }, 1000);
}

export function stopTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;
}

export function hideTimer() {
    stopTimer();
    if (timerDisplay) {
        timerDisplay.style.display = 'none';
    }
}

export function pauseTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
    isRunning = false;
}

export function resumeTimer() {
    if (remainingSeconds > 0 && !timerInterval) {
        isRunning = true;
        timerInterval = setInterval(() => {
            if (remainingSeconds > 0) {
                remainingSeconds--;
                updateDisplay();
            } else {
                stopTimer();
                onTimeUp();
            }
        }, 1000);
    }
}

export function addTime(minutes) {
    remainingSeconds += minutes * 60;
    if (remainingSeconds < 0) remainingSeconds = 0;
    updateDisplay();
}

export function getRemainingSeconds() {
    return remainingSeconds;
}

export function isTimerRunning() {
    return isRunning;
}

export function setTimerDisplay(text) {
    if (timerDisplay) {
        timerDisplay.textContent = text;
        timerDisplay.style.display = 'block';
    }
}

export function showTimer() {
    if (timerDisplay) {
        timerDisplay.style.display = 'block';
    }
}

function updateDisplay() {
    if (!timerDisplay) return;
    
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    const timeString = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    
    timerDisplay.textContent = timeString;
    
    // Update styling based on time remaining
    timerDisplay.classList.remove('warning', 'danger');
    
    if (remainingSeconds <= 60) {
        // Last minute - danger
        timerDisplay.classList.add('danger');
    } else if (remainingSeconds <= 300) {
        // Last 5 minutes - warning
        timerDisplay.classList.add('warning');
    }
}

function onTimeUp() {
    if (timerDisplay) {
        timerDisplay.textContent = 'TIME UP';
        timerDisplay.classList.add('danger');
    }
    
    // Show alert to user
    alert('Time is up! Please proceed to submit your test.');
}
