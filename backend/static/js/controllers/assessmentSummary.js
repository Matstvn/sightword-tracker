// ============================================================
// assessmentSummary.js - Assessment Summary Controller
// ============================================================

import { escapeHtml } from '../utils.js';

// ============================================================
// 1. DOM References
// ============================================================
const dom = {
    loadingSpinner: document.getElementById('loadingSpinner'),
    summaryContent: document.getElementById('summaryContent'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),

    learnerInfo: document.getElementById('learnerInfo'),
    levelBadge: document.getElementById('levelBadge'),
    totalWords: document.getElementById('totalWords'),
    correctCount: document.getElementById('correctCount'),
    incorrectCount: document.getElementById('incorrectCount'),
    masteryPercent: document.getElementById('masteryPercent'),
    masteryLabel: document.getElementById('masteryLabel'),
    masteryBar: document.getElementById('masteryBar'),
    recommendationText: document.getElementById('recommendationText'),
    wordResultsContainer: document.getElementById('wordResultsContainer'),

    backToProfileBtn: document.getElementById('backToProfileBtn'),
    newAssessmentBtn: document.getElementById('newAssessmentBtn'),
    printBtn: document.getElementById('printBtn'),
    exportBtn: document.getElementById('exportBtn'),
};

// ============================================================
// 2. State
// ============================================================
let assessmentId = null;
let learnerId = null;
let assessmentData = null;
let learnerData = null;

// ============================================================
// 3. Level Configuration
// ============================================================
const LEVELS = ['Pre-Primer', 'Primer', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'];

function getNextLevel(currentLevel) {
    const index = LEVELS.indexOf(currentLevel);
    if (index === -1 || index === LEVELS.length - 1) return null;
    return LEVELS[index + 1];
}

// ============================================================
// 4. Toast Helper
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
// 5. Helper: Slow Words (7-10 seconds)
// ============================================================
function getSlowWords(wordResults) {
    if (!wordResults || wordResults.length === 0) return [];
    const thresholdLow = 7000;
    const thresholdHigh = 10000;
    return wordResults
        .filter(r => r.response_time_ms !== null &&
                     r.response_time_ms >= thresholdLow &&
                     r.response_time_ms <= thresholdHigh)
        .map(r => ({
            word_id: r.word_id,
            word: getWordText(r),
            response_time_ms: r.response_time_ms,
            is_correct: r.is_correct,
        }));
}

function formatTime(ms) {
    if (!ms) return '—';
    return (ms / 1000).toFixed(1) + 's';
}

function getWordText(result) {
    if (!result) return '?';

    const directWord = result.word?.word || result.word || result.word_text || result.wordText || result.word_name || result.wordName;
    if (typeof directWord === 'string' && directWord.trim()) {
        return directWord.trim();
    }

    if (result.word_id != null) {
        return `Word ${result.word_id}`;
    }

    return '?';
}

// ============================================================
// 6. API Calls
// ============================================================

async function fetchAssessment(id) {
    const response = await fetch(`/api/assessments/${id}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch assessment: ${response.statusText}`);
    }
    return response.json();
}

async function fetchLearner(id) {
    const response = await fetch(`/api/learners/${id}?t=${Date.now()}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch learner: ${response.statusText}`);
    }
    return response.json();
}

async function advanceLevel(learnerId, newLevel) {
    console.log('🔵 advanceLevel called with:', { learnerId, newLevel });
    const response = await fetch(`/api/learners/${learnerId}/level`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level: newLevel }),
    });
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    console.log('✅ API Response:', result);
    return result;
}

// ============================================================
// 7. Main Rendering Function
// ============================================================

function renderSummary(assessment, learner) {
    console.log('🔵 Rendering summary for learner:', learner.first_name, learner.last_name);
    console.log('🔵 Current level from database:', learner.current_level);

    // 7a. Learner info
    dom.learnerInfo.textContent = `${learner.first_name} ${learner.last_name} • ${learner.lrn || 'No LRN'}`;
    dom.levelBadge.textContent = `Level: ${assessment.level_tested || '—'}`;

    // 7b. Stats
    const total = assessment.total_words || 0;
    const correct = assessment.correct_count || 0;
    const incorrect = total - correct;
    const mastery = assessment.mastery_percentage || 0;

    dom.totalWords.textContent = total;
    dom.correctCount.textContent = correct;
    dom.incorrectCount.textContent = incorrect;
    dom.masteryPercent.textContent = `${Math.round(mastery)}%`;
    dom.masteryLabel.textContent = `${Math.round(mastery)}%`;
    dom.masteryBar.style.width = `${Math.min(mastery, 100)}%`;

    // 7c. Recommendation
    const currentLevel = learner.current_level || 'Pre-Primer';
    const nextLevel = getNextLevel(currentLevel);
    const isPerfect = mastery === 100 && total > 0;

    let recommendation = '';
    let showAdvanceButton = false;

    if (isPerfect && nextLevel) {
        recommendation = `🎉 PERFECT SCORE! ${learner.first_name} got all ${total} words correct in ${currentLevel}! Ready to advance to ${nextLevel}!`;
        showAdvanceButton = true;
    } else if (isPerfect && !nextLevel) {
        recommendation = `🏆 PERFECT SCORE! ${learner.first_name} has mastered ALL levels! Outstanding achievement! 🎉`;
    } else if (mastery >= 80) {
        const missed = total - correct;
        recommendation = `📝 Good job! ${learner.first_name} got ${correct}/${total} correct. ${missed} word(s) to review. Practice the missed words and try again for a perfect score!`;
    } else if (mastery >= 60) {
        const missed = total - correct;
        recommendation = `📝 Almost there! ${learner.first_name} got ${correct}/${total} correct. ${missed} word(s) need more practice. Keep reviewing!`;
    } else {
        const missed = total - correct;
        recommendation = `🔁 ${learner.first_name} needs more practice. Only ${correct}/${total} correct. Review the missed words and try again.`;
    }
    dom.recommendationText.textContent = recommendation;

    // 7d. Perfect Score Badge
    const existingBadge = document.querySelector('.perfect-badge');
    if (existingBadge) existingBadge.remove();

    if (isPerfect) {
        const perfectBadge = document.createElement('div');
        perfectBadge.className = 'perfect-badge mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center';
        perfectBadge.innerHTML = `
            <span class="text-3xl">🌟</span>
            <p class="text-emerald-700 font-bold text-lg">PERFECT SCORE!</p>
            <p class="text-sm text-emerald-600">All ${total} words correct!</p>
        `;
        dom.recommendationText.after(perfectBadge);
    }

    // 7e. Advance Button
    const existingBtn = document.getElementById('advanceLevelBtn');
    if (existingBtn) existingBtn.remove();

    if (showAdvanceButton) {
        const advanceBtn = document.createElement('button');
        advanceBtn.id = 'advanceLevelBtn';
        advanceBtn.className = 'mt-3 px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition';
        advanceBtn.textContent = `🚀 Advance to ${nextLevel}`;
        advanceBtn.addEventListener('click', async function() {
            console.log('🔵 Advance button clicked');
            this.disabled = true;
            this.textContent = '⏳ Updating...';
            try {
                const result = await advanceLevel(learner.id, nextLevel);
                console.log('✅ Advance successful:', result);
                learner.current_level = result.current_level;
                dom.levelBadge.textContent = `Level: ${nextLevel}`;
                dom.recommendationText.textContent = `✅ ${learner.first_name} has advanced to ${nextLevel}! Ready for the next assessment.`;
                const pb = document.querySelector('.perfect-badge');
                if (pb) pb.remove();
                this.remove();
                showToast(`✅ ${learner.first_name} advanced to ${nextLevel}!`, 'success');
                dom.newAssessmentBtn.href = `/pages/teacherAssessment.html?learnerId=${learner.id}&learnerName=${encodeURIComponent(learner.first_name + ' ' + learner.last_name)}&level=${nextLevel}`;
                dom.newAssessmentBtn.textContent = `🔄 New Assessment (${nextLevel})`;
                setTimeout(() => window.location.reload(), 1500);
            } catch (error) {
                console.error('❌ Advance failed:', error);
                alert(`❌ Failed to update level: ${error.message || 'Unknown error'}`);
                this.disabled = false;
                this.textContent = `🚀 Advance to ${nextLevel}`;
            }
        });
        dom.recommendationText.after(advanceBtn);
    }

    // 7f. Word results (correct/incorrect tags)
    const wordResults = assessment.word_results || [];
    if (wordResults.length === 0) {
        dom.wordResultsContainer.innerHTML = '<p class="text-gray-500 text-center py-4">No word details available.</p>';
    } else {
        const correctWords = wordResults.filter(r => r.is_correct).map(r => getWordText(r));
        const incorrectWords = wordResults.filter(r => !r.is_correct).map(r => getWordText(r));

        let html = '';
        if (incorrectWords.length > 0) {
            html += `<div class="mb-4">
                <p class="text-sm font-semibold text-red-600 mb-2">❌ Missed Words (${incorrectWords.length})</p>
                <div>${incorrectWords.map(w => `<span class="word-tag incorrect">${escapeHtml(w)}</span>`).join('')}</div>
            </div>`;
        } else {
            html += `<div class="mb-4 text-emerald-600 font-medium">✅ All words correct!</div>`;
        }

        if (correctWords.length > 0) {
            html += `<div>
                <p class="text-sm font-semibold text-emerald-600 mb-2">✅ Correct Words (${correctWords.length})</p>
                <div>${correctWords.map(w => `<span class="word-tag correct">${escapeHtml(w)}</span>`).join('')}</div>
            </div>`;
        }

        dom.wordResultsContainer.innerHTML = html;
    }

    // 7g. Action buttons
    dom.backToProfileBtn.href = `/pages/learner.html?id=${learner.id}`;
    dom.newAssessmentBtn.href = `/pages/teacherAssessment.html?learnerId=${learner.id}&learnerName=${encodeURIComponent(learner.first_name + ' ' + learner.last_name)}&level=${learner.current_level || 'Pre-Primer'}`;
    dom.newAssessmentBtn.textContent = `🔄 New Assessment (${learner.current_level || 'Pre-Primer'})`;

    // ============================================================
    // 7h. COMBINED RETEST SECTION (Incorrect OR Slow)
    // ============================================================

    // Get incorrect and slow word lists
    const incorrectList = (assessment.word_results || []).filter(r => !r.is_correct);
    const slowList = getSlowWords(assessment.word_results || []);

    // Combine by word_id (unique)
    const reviewMap = new Map();
    incorrectList.forEach(r => {
        reviewMap.set(r.word_id, {
            word_id: r.word_id,
            word: getWordText(r),
            response_time_ms: r.response_time_ms,
            reason: 'Incorrect',
        });
    });
    slowList.forEach(s => {
        if (reviewMap.has(s.word_id)) {
            // Already incorrect -> mark as Both
            const existing = reviewMap.get(s.word_id);
            existing.reason = 'Both';
        } else {
            reviewMap.set(s.word_id, {
                word_id: s.word_id,
                word: s.word,
                response_time_ms: s.response_time_ms,
                reason: 'Slow',
            });
        }
    });

    const reviewWords = Array.from(reviewMap.values());

    // Remove existing review section if any
    const existingReview = document.getElementById('reviewSection');
    if (existingReview) existingReview.remove();

    if (reviewWords.length > 0) {
        const reviewContainer = document.createElement('div');
        reviewContainer.id = 'reviewSection';
        reviewContainer.className = 'mt-6 bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden';

        let html = `
            <div class="px-6 py-4 border-b border-gray-200 bg-purple-50">
                <h2 class="text-lg font-semibold text-gray-800 flex items-center gap-2">
                    📝 Words to Review (${reviewWords.length})
                </h2>
                <p class="text-sm text-gray-500 mt-1">Includes words that were incorrect or took 7–10 seconds. Click "Retest All" to try them again.</p>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full">
                    <thead class="bg-gray-50 border-b border-gray-200">
                        <tr>
                            <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Word</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Time</th>
                            <th class="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Reason</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-100">
        `;
        reviewWords.forEach(w => {
            const time = w.response_time_ms ? formatTime(w.response_time_ms) : '—';
            let reasonBadge = '';
            if (w.reason === 'Incorrect') {
                reasonBadge = '<span class="text-red-600 font-medium">❌ Incorrect</span>';
            } else if (w.reason === 'Slow') {
                reasonBadge = '<span class="text-yellow-600 font-medium">⏱️ Slow</span>';
            } else {
                reasonBadge = '<span class="text-purple-600 font-medium">⚠️ Both</span>';
            }
            html += `
                <tr>
                    <td class="px-6 py-3 text-sm font-medium text-gray-800">${escapeHtml(w.word)}</td>
                    <td class="px-6 py-3 text-sm text-center text-gray-600">${time}</td>
                    <td class="px-6 py-3 text-sm text-center">${reasonBadge}</td>
                </tr>
            `;
        });
        html += `
                    </tbody>
                </table>
            </div>
            <div class="px-6 py-4 border-t border-gray-200 bg-gray-50">
                <button id="retestReviewBtn" class="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition flex items-center gap-2">
                    🔄 Retest All (${reviewWords.length})
                </button>
            </div>
        `;
        reviewContainer.innerHTML = html;
        // Insert after word results
        dom.wordResultsContainer.parentNode.insertBefore(reviewContainer, dom.wordResultsContainer.nextSibling);

        // Retest button event listener
        const retestBtn = reviewContainer.querySelector('#retestReviewBtn');
        if (retestBtn) {
            const wordIds = reviewWords.map(w => w.word_id).join(',');
            retestBtn.addEventListener('click', () => {
                const url = `/pages/teacherAssessment.html?learnerId=${learner.id}&learnerName=${encodeURIComponent(learner.first_name + ' ' + learner.last_name)}&wordIds=${wordIds}&levelLabel=Retest-Review`;
                console.log('🔵 Retest URL (review):', url);
                window.location.href = url;
            });
        }
    }

    // Show content
    dom.loadingSpinner.classList.add('hidden');
    dom.summaryContent.classList.remove('hidden');
}

// ============================================================
// 8. Error Handling
// ============================================================
function showError(message) {
    dom.loadingSpinner.classList.add('hidden');
    dom.summaryContent.classList.add('hidden');
    dom.errorState.classList.remove('hidden');
    dom.errorMessage.textContent = message;
}

// ============================================================
// 9. Report Actions
// ============================================================
function printSummary() {
    window.print();
}

function exportSummaryReport() {
    if (!assessmentData || !learnerData) {
        showToast('Report data is not ready yet.', 'error');
        return;
    }

    const learnerName = `${learnerData.first_name || ''} ${learnerData.last_name || ''}`.trim();
    const level = assessmentData.level_tested || learnerData.current_level || '—';
    const total = assessmentData.total_words || 0;
    const correct = assessmentData.correct_count || 0;
    const incorrect = Math.max(total - correct, 0);
    const mastery = Math.round(assessmentData.mastery_percentage || 0);
    const recommendation = dom.recommendationText.textContent || 'No recommendation available.';
    const wordResults = assessmentData.word_results || [];
    const correctWords = wordResults.filter(r => r.is_correct).map(r => getWordText(r));
    const incorrectWords = wordResults.filter(r => !r.is_correct).map(r => getWordText(r));
    const reviewWords = Array.from(new Map(
        [
            ...wordResults.filter(r => !r.is_correct).map(r => ({ word_id: r.word_id, word: getWordText(r), reason: 'Incorrect' })),
            ...getSlowWords(wordResults).map(r => ({ word_id: r.word_id, word: r.word, reason: 'Slow' })),
        ].map(item => [item.word_id, item])
    ).values());

    const reportLines = [
        'Assessment Summary Report',
        '========================',
        `Learner: ${learnerName || 'Unknown'}`,
        `LRN: ${learnerData.lrn || '—'}`,
        `Level: ${level}`,
        `Date: ${new Date(assessmentData.created_at || Date.now()).toLocaleString()}`,
        '',
        `Total Words: ${total}`,
        `Correct: ${correct}`,
        `Incorrect: ${incorrect}`,
        `Mastery: ${mastery}%`,
        '',
        'Recommendation:',
        recommendation,
        '',
        'Incorrect Words:',
        incorrectWords.length ? incorrectWords.join(', ') : 'None',
        '',
        'Correct Words:',
        correctWords.length ? correctWords.join(', ') : 'None',
        '',
        'Words to Review:',
        reviewWords.length ? reviewWords.map(w => `${w.word} (${w.reason})`).join(', ') : 'None',
    ];

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-report-${learnerData.id || assessmentId}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    showToast('Report exported successfully.', 'success');
}

// ============================================================
// 10. Initialisation
// ============================================================
async function init() {
    const params = new URLSearchParams(window.location.search);
    assessmentId = parseInt(params.get('assessmentId'), 10);
    learnerId = parseInt(params.get('learnerId'), 10);

    if (!assessmentId || isNaN(assessmentId)) {
        showError('Invalid assessment ID.');
        return;
    }

    try {
        const [assessment, learner] = await Promise.all([
            fetchAssessment(assessmentId),
            learnerId ? fetchLearner(learnerId) : null,
        ]);

        assessmentData = assessment;
        if (!learnerId && assessment.learner_id) {
            learnerData = await fetchLearner(assessment.learner_id);
        } else if (learner) {
            learnerData = learner;
        } else {
            throw new Error('Learner information not found.');
        }

        console.log('✅ Loaded learner data:', learnerData);
        console.log('✅ Current level from database:', learnerData.current_level);

        renderSummary(assessmentData, learnerData);

    } catch (error) {
        console.error('❌ Failed to load summary:', error);
        showError(`Failed to load assessment: ${error.message}`);
    }
}

// ============================================================
// 11. Event Listeners
// ============================================================
dom.printBtn.addEventListener('click', printSummary);
dom.exportBtn.addEventListener('click', exportSummaryReport);

// ============================================================
// 12. Start the app
// ============================================================
init();