// ============================================================
// teacherAssessment.js - Assessment Controller with Timer & Start Button
// ============================================================

import { api } from '../api.js';

// ============================================================
// 1. DOM References
// ============================================================
const dom = {
    learnerName: document.getElementById('learnerName'),
    assessmentLevel: document.getElementById('assessmentLevel'),
    progressCounter: document.getElementById('progressCounter'),
    progressPercent: document.getElementById('progressPercent'),
    progressBar: document.getElementById('progressBar'),
    currentWord: document.getElementById('currentWord'),

    correctBtn: document.getElementById('correctBtn'),
    incorrectBtn: document.getElementById('incorrectBtn'),
    previousBtn: document.getElementById('previousBtn'),
    finishBtn: document.getElementById('finishBtn'),
    exitBtn: document.getElementById('exitBtn'),
    openReaderBtn: document.getElementById('openReaderBtn'),
    readerStatus: document.getElementById('readerStatus'),
    startAssessmentBtn: document.getElementById('startAssessmentBtn'),

    timerText: document.getElementById('timerText'),
    timerCircle: document.getElementById('timerCircle'),
};

// ============================================================
// 2. Constants
// ============================================================
const TIMER_SECONDS = 10;
const CIRCUMFERENCE = 125.6;
const MAX_WORDS = 100; // maximum number of words per assessment
const HEARTBEAT_INTERVAL_MS = 15000; // send ping every 15s
const HEARTBEAT_TIMEOUT_MS = 8000; // consider dead if no pong within 8s
const RECONNECT_BASE_DELAY = 1000; // 1s
const RECONNECT_MAX_DELAY = 30000; // 30s
const STORAGE_KEY_PREFIX = 'sightword_assessment_draft_';
const PENDING_SAVE_PREFIX = 'sightword_pending_save_';
const SAVE_RETRY_DELAY = 5000; // retry save after 5s if offline

let heartbeatInterval = null;
let heartbeatTimeout = null;
let lastPong = 0;
let reconnectAttempts = 0;
let pendingSaveTimeout = null;

// ============================================================
// 3. Assessment State
// ============================================================
const state = {
    learnerId: null,
    learnerName: '',
    level: '',
    words: [],
    currentIndex: 0,
    results: [],
    totalWords: 0,
    correctCount: 0,
    isStarted: false,
    isFinished: false,
    isSaving: false,
    timerInterval: null,
    isTimerRunning: false,
    startTime: null,
};

// ============================================================
// 4. WebSocket
// ============================================================
let ws = null;
let readerWindow = null;

function connectWebSocket() {
    if (!state.learnerId) return;
    // Avoid creating duplicate sockets
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const room = `learner_${state.learnerId}`;
    const wsUrl = `${protocol}//${host}/ws/${room}`;

    try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            console.log('✅ WebSocket connected (Teacher)');
            reconnectAttempts = 0;
            lastPong = Date.now();
            updateReaderStatus('connected');
            startHeartbeat();
        };

        ws.onclose = (ev) => {
            console.log('❌ WebSocket disconnected (Teacher)', ev);
            updateReaderStatus('disconnected');
            stopHeartbeat();
            scheduleReconnect();
        };

        ws.onerror = (error) => {
            console.error('WebSocket error (Teacher):', error);
            updateReaderStatus('error');
        };

        ws.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data);
                // Handle app-level pong
                if (msg && msg.type === 'pong') {
                    lastPong = Date.now();
                    return;
                }
                console.log('📨 Received (Teacher):', msg);
            } catch (e) {
                // ignore non-JSON messages
            }
        };
    } catch (error) {
        console.error('Failed to connect WebSocket:', error);
        updateReaderStatus('error');
        scheduleReconnect();
    }
}

function broadcastWord(word, index, total) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
            type: 'word',
            word: word,
            index: index + 1,
            total: total,
        }));
        console.log(`📤 Broadcast: "${word}" (${index + 1}/${total})`);
    }
}

function updateReaderStatus(status) {
    const el = dom.readerStatus;
    if (!el) return;
    const statusMap = {
        connected: { text: '🟢 Reader Connected', color: 'text-emerald-600' },
        disconnected: { text: '🔴 Reader Disconnected', color: 'text-red-600' },
        error: { text: '⚠️ Reader Error', color: 'text-yellow-600' },
    };
    const s = statusMap[status] || statusMap.disconnected;
    el.textContent = s.text;
    el.className = `text-sm font-medium ${s.color}`;
}

// ============================================================
// 5. Timer Functions
// ============================================================

function startTimer() {
    if (!state.isStarted || state.isFinished) return;
    stopTimer();

    let secondsLeft = TIMER_SECONDS;
    updateTimerDisplay(secondsLeft);
    state.isTimerRunning = true;
    state.startTime = performance.now();

    // Single source of truth for the countdown: the interval ticks every
    // 100ms and fires handleTimeout() once secondsLeft reaches 0. The old
    // code also ran a parallel setTimeout to the same end, which meant two
    // independent timers could race or drift out of sync. Removed.
    state.timerInterval = setInterval(() => {
        secondsLeft -= 0.1;
        if (secondsLeft <= 0) {
            secondsLeft = 0;
            clearInterval(state.timerInterval);
            state.isTimerRunning = false;
            handleTimeout();
            return;
        }
        updateTimerDisplay(secondsLeft);
    }, 100);
}

function stopTimer() {
    clearInterval(state.timerInterval);
    state.isTimerRunning = false;
}

function updateTimerDisplay(seconds) {
    const rounded = Math.ceil(seconds);
    dom.timerText.textContent = rounded;
    const progress = seconds / TIMER_SECONDS;
    const offset = CIRCUMFERENCE * (1 - progress);
    dom.timerCircle.style.strokeDashoffset = offset;
    if (progress > 0.5) {
        dom.timerCircle.style.stroke = '#22c55e';
    } else if (progress > 0.25) {
        dom.timerCircle.style.stroke = '#eab308';
    } else {
        dom.timerCircle.style.stroke = '#ef4444';
    }
}

function handleTimeout() {
    if (!state.isStarted || state.isFinished) return;
    if (state.currentIndex >= state.words.length) return;

    const word = state.words[state.currentIndex];
    state.results.push({
        word_id: word.id,
        is_correct: false,
        response_time_ms: null,
    });
    state.currentIndex++;
    displayCurrentWord();
    updateButtonStates();
}

// ============================================================
// 6. Core Functions
// ============================================================

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        learnerId: parseInt(params.get('learnerId'), 10),
        learnerName: params.get('learnerName') || 'Learner',
        level: params.get('level') || 'Pre-Primer',
        wordIds: params.get('wordIds'),
        levelLabel: params.get('levelLabel') || '',
    };
}

function getStorageKey() {
    return `${STORAGE_KEY_PREFIX}${state.learnerId || 'unknown'}_${state.level || 'unknown'}`;
}

function getPendingSaveKey() {
    return `${PENDING_SAVE_PREFIX}${state.learnerId || 'unknown'}_${state.level || 'unknown'}`;
}

function saveDraft() {
    if (!state.learnerId || state.words.length === 0) return;
    const data = {
        learnerId: state.learnerId,
        learnerName: state.learnerName,
        level: state.level,
        words: state.words,
        currentIndex: state.currentIndex,
        results: state.results,
        correctCount: state.correctCount,
        isStarted: state.isStarted,
        isFinished: state.isFinished,
    };
    try {
        localStorage.setItem(getStorageKey(), JSON.stringify(data));
    } catch (error) {
        console.warn('Could not save draft to localStorage:', error);
    }
}

function restoreDraft() {
    try {
        const raw = localStorage.getItem(getStorageKey());
        if (!raw) return false;
        const draft = JSON.parse(raw);
        if (!draft || draft.learnerId !== state.learnerId) return false;

        state.learnerName = draft.learnerName || state.learnerName;
        state.level = draft.level || state.level;
        state.words = draft.words || state.words;
        state.currentIndex = draft.currentIndex || 0;
        state.results = draft.results || [];
        state.correctCount = draft.correctCount || 0;
        state.isStarted = draft.isStarted || false;
        state.isFinished = draft.isFinished || false;
        return true;
    } catch (error) {
        console.warn('Could not restore draft from localStorage:', error);
        return false;
    }
}

function clearDraft() {
    try {
        localStorage.removeItem(getStorageKey());
    } catch (error) {
        console.warn('Could not clear draft from localStorage:', error);
    }
}

function queueSaveRetry(payload) {
    try {
        localStorage.setItem(getPendingSaveKey(), JSON.stringify(payload));
    } catch (error) {
        console.warn('Could not queue pending save:', error);
    }
}

function getPendingSave() {
    try {
        const raw = localStorage.getItem(getPendingSaveKey());
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        console.warn('Could not read pending save:', error);
        return null;
    }
}

function clearPendingSave() {
    try {
        localStorage.removeItem(getPendingSaveKey());
    } catch (error) {
        console.warn('Could not clear pending save:', error);
    }
}

async function retryPendingSave() {
    const payload = getPendingSave();
    if (!payload) return;
    if (!navigator.onLine) return;

    try {
        const saved = await api.saveAssessment(payload);
        console.log('✅ Pending assessment saved after retry:', saved);
        clearPendingSave();
        clearDraft();
        if (saved.id && payload.learner_id) {
            window.location.href = `/pages/assessmentSummary.html?assessmentId=${saved.id}&learnerId=${payload.learner_id}`;
        }
    } catch (error) {
        console.warn('Pending save retry failed:', error);
        if (!pendingSaveTimeout) {
            pendingSaveTimeout = setTimeout(() => {
                pendingSaveTimeout = null;
                retryPendingSave();
            }, SAVE_RETRY_DELAY);
        }
    }
}

function updateProgress() {
    const current = state.currentIndex + 1;
    const total = state.words.length;
    // Use the clamped "current" (1-indexed, capped at total) rather than
    // the raw currentIndex — the old version divided currentIndex/total,
    // which under-reports by one word the whole way through (e.g. showing
    // 0% while answering word #1 of 10 instead of 10%).
    const displayedCount = Math.min(current, total);
    const percent = total > 0 ? Math.round((displayedCount / total) * 100) : 0;
    dom.progressCounter.textContent = `${displayedCount} / ${total}`;
    dom.progressPercent.textContent = `${percent}%`;
    dom.progressBar.value = percent;
    dom.progressBar.max = 100;
}

function displayCurrentWord() {
    stopTimer();

    if (state.currentIndex < state.words.length) {
        const wordObj = state.words[state.currentIndex];
        dom.currentWord.textContent = wordObj.word.toLowerCase();
        broadcastWord(wordObj.word, state.currentIndex, state.words.length);
        if (state.isStarted && !state.isFinished) {
            startTimer();
        }
    } else {
        dom.currentWord.textContent = '🎉 DONE!';
        state.isFinished = true;
        state.isSaving = false; // Reset in case of previous error
        dom.finishBtn.disabled = false; // Enable button
        console.log('✅ Assessment complete. Finish button enabled.');
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                type: 'word',
                word: '🎉 DONE!',
                index: state.words.length,
                total: state.words.length,
            }));
        }
        stopTimer();
    }
    saveDraft();
    updateProgress();
}
// recordResult // 

function recordResult(isCorrect) {
    if (state.currentIndex >= state.words.length || !state.isStarted || state.isFinished) return;
    stopTimer();

    // Capture elapsed time regardless of correctness. A manually-marked
    // incorrect answer still had a real response time and that's useful
    // diagnostic data (a fast wrong guess vs. a slow, hesitant wrong answer
    // are meaningfully different). null should mean "no response was
    // given" — that's reserved for the true timeout path in handleTimeout().
    let responseTimeMs = null;
    if (state.startTime !== null) {
        responseTimeMs = Math.round(performance.now() - state.startTime);
    }

    const word = state.words[state.currentIndex];
    state.results.push({
        word_id: word.id,
        is_correct: isCorrect,
        response_time_ms: responseTimeMs,
    });

    if (isCorrect) state.correctCount++;
    state.currentIndex++;
    displayCurrentWord();
    updateButtonStates();
}

function goToPrevious() {
    if (state.currentIndex <= 0 || !state.isStarted || state.isFinished) return;
    const lastResult = state.results.pop();
    if (lastResult && lastResult.is_correct) state.correctCount--;
    state.currentIndex--;
    stopTimer();
    displayCurrentWord();
    updateButtonStates();
    if (state.currentIndex < state.words.length) {
        const wordObj = state.words[state.currentIndex];
        broadcastWord(wordObj.word, state.currentIndex, state.words.length);
    }
}

function updateButtonStates() {
    const isFinished = state.currentIndex >= state.words.length;
    const isStarted = state.isStarted && !isFinished;

    dom.correctBtn.disabled = !isStarted || isFinished;
    dom.incorrectBtn.disabled = !isStarted || isFinished;
    dom.previousBtn.disabled = !isStarted || state.currentIndex === 0;

    // Finish button: enable if started and (finished) and not saving
    dom.finishBtn.disabled = !state.isStarted || !state.isFinished || state.isSaving;
}

// ============================================================
// 7. Start Assessment
// ============================================================

function startAssessment() {
    if (state.isStarted) return;
    if (state.words.length === 0) {
        alert('⚠️ No words loaded. Please refresh and try again.');
        return;
    }

    state.isStarted = true;
    dom.startAssessmentBtn.textContent = '⏳ In Progress...';
    dom.startAssessmentBtn.disabled = true;

    dom.correctBtn.disabled = false;
    dom.incorrectBtn.disabled = false;
    dom.previousBtn.disabled = true;
    dom.finishBtn.disabled = true;

    displayCurrentWord();
    updateButtonStates();

    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'system', message: 'Assessment started' }));
    }
}

// ============================================================
// 8. Open Reader
// ============================================================

function openReader() {
    if (!state.learnerId) {
        alert('⚠️ No learner ID found. Please restart the assessment.');
        return;
    }
    const url = `/pages/reader.html?learnerId=${state.learnerId}`;
    readerWindow = window.open(url, '_blank', 'width=1920,height=1080,menubar=no,toolbar=no,location=no,status=no,resizable=yes');
    if (readerWindow) {
        dom.openReaderBtn.textContent = '🔄 Refresh Reader';
        dom.openReaderBtn.className = 'px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg transition text-sm';
        showToast('📺 Reader window opened. Position it on your Smart TV!', 'info');
    } else {
        alert('⚠️ Please allow popups for this site to open the Reader.');
    }
}

// ============================================================
// 9. Toast Helper
// ============================================================

function showToast(message, type = 'success') {
    const colors = {
        success: 'bg-emerald-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500',
    };
    const toast = document.createElement('div');
    toast.className = `fixed bottom-4 right-4 ${colors[type] || colors.info} text-white px-6 py-4 rounded-xl shadow-lg z-50 max-w-sm transition-all duration-300 transform translate-y-0 opacity-100`;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(20px)';
        setTimeout(() => toast.remove(), 300);
    }, 5000);
}

// ============================================================
// 10. Finish & Save (with Debugging)
// ============================================================

async function finishAssessment() {
    console.log('🔵 finishAssessment called');
    console.log('🔵 state.isStarted:', state.isStarted);
    console.log('🔵 state.isFinished:', state.isFinished);
    console.log('🔵 state.results.length:', state.results.length);
    console.log('🔵 state.isSaving:', state.isSaving);

    if (!state.isStarted || state.isSaving) {
        console.warn('⚠️ finishAssessment aborted: not started or already saving');
        return;
    }

    state.isSaving = true;
    dom.finishBtn.textContent = '⏳ Saving...';
    dom.finishBtn.disabled = true;

    const total = state.words.length;
    const correct = state.correctCount;
    const mastery = total > 0 ? (correct / total) * 100 : 0;
    const incorrectWords = (state.results || [])
        .filter(result => !result.is_correct)
        .map(result => result.word_id);

    const payload = {
        learner_id: state.learnerId,
        level_tested: state.level,
        total_words: total,
        correct_count: correct,
        mastery_percentage: Math.round(mastery * 100) / 100,
        word_results: state.results,
    };

    console.log('📤 Payload:', JSON.stringify(payload, null, 2));

    try {
        const saved = await api.saveAssessment(payload);
        console.log('✅ Assessment saved:', saved);

        if (incorrectWords.length > 0) {
            await Promise.allSettled(
                incorrectWords.map(wordId => fetch('/api/assessments/practice-words', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ learner_id: state.learnerId, word_id: wordId, incorrect_count: 1 })
                }))
            );
        }

        clearDraft();
        clearPendingSave();
        if (ws) ws.close();
        if (readerWindow && !readerWindow.closed) readerWindow.close();
        window.location.href = `/pages/assessmentSummary.html?assessmentId=${saved.id}&learnerId=${state.learnerId}`;
    } catch (error) {
        console.error('❌ Failed to save assessment:', error);
        queueSaveRetry(payload);
        showToast('⚠️ Save failed. Offline draft queued and will retry automatically.', 'warning');
        dom.finishBtn.textContent = '🏁 Finish Assessment';
        dom.finishBtn.disabled = false;
        state.isSaving = false;
        pendingSaveTimeout = setTimeout(() => {
            pendingSaveTimeout = null;
            retryPendingSave();
        }, SAVE_RETRY_DELAY);
    }
}

function exitAssessment() {
    if (confirm('Are you sure you want to exit?\n\nProgress will NOT be saved if you haven\'t finished.')) {
        if (ws) ws.close();
        if (readerWindow && !readerWindow.closed) readerWindow.close();
        window.location.href = '/';
    }
}

// ============================================================
// 11. Keyboard Shortcuts
// ============================================================

function handleKeyboard(event) {
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;

    switch (event.key) {
        case 'ArrowLeft':  event.preventDefault(); dom.incorrectBtn.click(); break;
        case 'ArrowRight': event.preventDefault(); dom.correctBtn.click(); break;
        case 'ArrowUp':    event.preventDefault(); dom.previousBtn.click(); break;
        case 'Enter':      if (!dom.finishBtn.disabled) { event.preventDefault(); dom.finishBtn.click(); } break;
        case 'Escape':     event.preventDefault(); dom.exitBtn.click(); break;
        case ' ':          event.preventDefault(); if (!dom.correctBtn.disabled) dom.correctBtn.click(); break;
    }
}

// ============================================================
// 12. Initialisation
// ============================================================

async function init() {
    const params = getUrlParams();
    state.learnerId = params.learnerId;
    state.learnerName = params.learnerName;

    let levelStr = String(params.level || 'Pre-Primer');
    let words = [];
    let levelDisplay = '';

    if (params.wordIds) {
        try {
            words = await api.getWords({ ids: params.wordIds });
            words = words.slice(0, MAX_WORDS); // Limit to MAX_WORDS
            state.level = params.levelLabel || 'Retest';
            levelDisplay = state.level;
            dom.assessmentLevel.textContent = levelDisplay;
        } catch (error) {
            console.error('Failed to fetch retest words:', error);
            dom.currentWord.textContent = '❌ ERROR LOADING WORDS';
            return;
        }
    } else {
        state.level = levelStr;
        levelDisplay = state.level;
        dom.assessmentLevel.textContent = levelDisplay;
        try {
            words = await api.getWords({ level: state.level });
            words = words.slice(0, MAX_WORDS); // Limit to MAX_WORDS
        } catch (error) {
            console.error('Failed to fetch words:', error);
            dom.currentWord.textContent = '❌ ERROR LOADING WORDS';
            return;
        }
    }

    if (!words || words.length === 0) {
        dom.currentWord.textContent = '⚠️ No words found.';
        dom.finishBtn.disabled = true;
        dom.correctBtn.disabled = true;
        dom.incorrectBtn.disabled = true;
        dom.startAssessmentBtn.disabled = true;
        dom.previousBtn.disabled = true;
        return;
    }

    dom.learnerName.textContent = state.learnerName;
    state.words = words;

    const restored = restoreDraft();
    if (restored && state.isStarted) {
        showToast('🔄 Restored your in-progress assessment from local storage.', 'info');
    } else {
        state.currentIndex = 0;
        state.results = [];
        state.correctCount = 0;
        state.isStarted = false;
        state.isFinished = false;
    }

    connectWebSocket();
    updateViewForState();
    if (navigator.onLine) {
        retryPendingSave();
    }

    window.addEventListener('online', () => {
        showToast('✅ Back online. Retrying saved assessment automatically.', 'success');
        retryPendingSave();
    });
    window.addEventListener('offline', () => {
        showToast('⚠️ You are offline. Progress is saved locally until connectivity returns.', 'warning');
    });
}

function updateViewForState() {
    if (state.currentIndex < state.words.length && state.isStarted && !state.isFinished) {
        displayCurrentWord();
    } else if (state.words.length > 0) {
        dom.currentWord.textContent = state.isFinished ? '🎉 DONE!' : '▶️ Press Start';
    }

    dom.correctBtn.disabled = !state.isStarted || state.isFinished;
    dom.incorrectBtn.disabled = !state.isStarted || state.isFinished;
    dom.previousBtn.disabled = !state.isStarted || state.currentIndex === 0;
    dom.finishBtn.disabled = !state.isStarted || !state.isFinished || state.isSaving;
    dom.startAssessmentBtn.disabled = state.isStarted;
    updateProgress();
}

// ============================================================
// 13. Event Listeners
// ============================================================

dom.correctBtn.addEventListener('click', () => recordResult(true));
dom.incorrectBtn.addEventListener('click', () => recordResult(false));
dom.previousBtn.addEventListener('click', goToPrevious);
dom.finishBtn.addEventListener('click', finishAssessment);
dom.exitBtn.addEventListener('click', exitAssessment);
dom.openReaderBtn.addEventListener('click', openReader);
dom.startAssessmentBtn.addEventListener('click', startAssessment);

document.addEventListener('keydown', handleKeyboard);

// ============================================================
// 14. Start the app
// ============================================================

init();