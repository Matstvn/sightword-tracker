// ============================================================
// learner.js - Learner Profile Controller
// ============================================================

import { escapeHtml } from './utils.js';

// ============================================================
// 1. DOM References
// ============================================================
const dom = {
    statusBadge: document.getElementById('status-badge'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    profileContent: document.getElementById('profileContent'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),

    learnerAvatar: document.getElementById('learnerAvatar'),
    learnerName: document.getElementById('learnerName'),
    learnerLRN: document.getElementById('learnerLRN'),
    learnerSection: document.getElementById('learnerSection'),
    // ✅ REMOVED: learnerGrade is no longer used

    totalAssessments: document.getElementById('totalAssessments'),
    overallMastery: document.getElementById('overallMastery'),
    currentLevel: document.getElementById('currentLevel'),

    historyBody: document.getElementById('historyBody'),
    emptyHistory: document.getElementById('emptyHistory'),

    startAssessmentBtn: document.getElementById('startAssessmentBtn'),
};

// ============================================================
// 2. State
// ============================================================
let learnerId = null;
let learnerData = null;
let assessments = [];

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
// 4. API Calls
// ============================================================

async function fetchLearner(id) {
    const response = await fetch(`/api/learners/${id}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch learner: ${response.statusText}`);
    }
    return response.json();
}

async function fetchAssessments(learnerId) {
    const response = await fetch(`/api/assessments/learner/${learnerId}`);
    if (!response.ok) {
        throw new Error(`Failed to fetch assessments: ${response.statusText}`);
    }
    return response.json();
}

async function checkBackendHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        dom.statusBadge.innerHTML = `
            <span class="w-2 h-2 bg-green-400 rounded-full inline-block"></span>
            <span>Backend: ${data.status}</span>
        `;
        dom.statusBadge.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium flex items-center gap-2';
        return true;
    } catch (error) {
        dom.statusBadge.innerHTML = `
            <span class="w-2 h-2 bg-red-400 rounded-full inline-block"></span>
            <span>Backend Offline</span>
        `;
        dom.statusBadge.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium flex items-center gap-2';
        console.error('Health check failed:', error);
        return false;
    }
}

// ============================================================
// 5. Rendering
// ============================================================

function renderLearnerHeader(learner) {
    const initial = (learner.first_name?.[0] || '?').toUpperCase();
    dom.learnerAvatar.textContent = initial;
    dom.learnerName.textContent = `${learner.first_name} ${learner.last_name}`;
    dom.learnerLRN.textContent = `LRN: ${learner.lrn || '—'}`;
    
    // ✅ Show only section (not grade)
    dom.learnerSection.textContent = learner.section || 'No section';
    
    // ✅ Display the sight word level (current_level) with a badge
    const levelDisplay = document.getElementById('currentLevelDisplay');
    if (levelDisplay) {
        const level = learner.current_level || 'Pre-Primer';
        levelDisplay.textContent = level;
    }
}

function renderStats(assessments) {
    const total = assessments.length;
    dom.totalAssessments.textContent = total;

    if (total === 0) {
        dom.overallMastery.textContent = '—';
        dom.currentLevel.textContent = '—';
        return;
    }

    const totalMastery = assessments.reduce((sum, a) => sum + (a.mastery_percentage || 0), 0);
    const avgMastery = totalMastery / total;
    dom.overallMastery.textContent = `${Math.round(avgMastery)}%`;

    const sorted = [...assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    const latest = sorted[0];
    dom.currentLevel.textContent = latest.level_tested || '—';

    // Add "Next Level Goal" if needed
    const nextLevel = getNextLevel(latest.level_tested || 'Pre-Primer');
    const statsContainer = document.getElementById('currentLevel').parentElement;
    const existingGoal = statsContainer?.querySelector('.goal-label');
    if (existingGoal) existingGoal.remove();
    
    if (statsContainer && nextLevel) {
        const goalLabel = document.createElement('p');
        goalLabel.className = 'text-sm text-gray-500 mt-1 goal-label';
        goalLabel.textContent = `🎯 Goal: 100% to advance to ${nextLevel}`;
        statsContainer.appendChild(goalLabel);
    } else if (statsContainer) {
        const goalLabel = document.createElement('p');
        goalLabel.className = 'text-sm text-emerald-600 mt-1 goal-label font-medium';
        goalLabel.textContent = '🏆 All levels mastered!';
        statsContainer.appendChild(goalLabel);
    }
}

function buildMasteryChart(assessments) {
    const svg = document.getElementById('masteryChart');
    if (!svg) return;

    const sorted = [...assessments].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sorted.length === 0) {
        svg.innerHTML = '<text x="20" y="40" fill="#64748b" font-size="14">No assessment data available.</text>';
        return;
    }

    const width = 520;
    const height = 220;
    const padding = { top: 20, right: 20, bottom: 40, left: 42 };
    const innerWidth = width - padding.left - padding.right;
    const innerHeight = height - padding.top - padding.bottom;
    const values = sorted.map(a => Math.min(100, Math.max(0, a.mastery_percentage || 0)));
    const maxValue = 100;

    const points = values.map((value, index) => {
        const x = padding.left + (index / Math.max(sorted.length - 1, 1)) * innerWidth;
        const y = padding.top + (1 - value / maxValue) * innerHeight;
        return { x, y, value };
    });

    const linePath = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(' ');
    const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${height - padding.bottom} L ${points[0].x.toFixed(1)} ${height - padding.bottom} Z`;

    const gridLines = [100, 75, 50, 25, 0].map(tick => {
        const y = padding.top + (1 - tick / maxValue) * innerHeight;
        return `<line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="#e2e8f0" stroke-dasharray="4 4" />`;
    }).join('');

    const labels = [100, 75, 50, 25, 0].map(tick => {
        const y = padding.top + (1 - tick / maxValue) * innerHeight;
        return `<text x="${padding.left - 8}" y="${y + 4}" text-anchor="end" font-size="12" fill="#64748b">${tick}</text>`;
    }).join('');

    const dateLabels = sorted.map((assessment, index) => {
        const x = padding.left + (index / Math.max(sorted.length - 1, 1)) * innerWidth;
        const date = new Date(assessment.created_at);
        const label = date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
        return `<text x="${x}" y="${height - 12}" text-anchor="middle" font-size="11" fill="#64748b">${label}</text>`;
    }).join('');

    const markers = points.map((point, index) => `
        <circle cx="${point.x}" cy="${point.y}" r="5" fill="#0B3D6E" stroke="#fff" stroke-width="2"></circle>
        <text x="${point.x}" y="${point.y - 10}" text-anchor="middle" font-size="11" fill="#0B3D6E">${Math.round(point.value)}%</text>
    `).join('');

    svg.innerHTML = `
        <rect x="0" y="0" width="${width}" height="${height}" rx="12" fill="#fff"></rect>
        ${gridLines}
        <path d="${areaPath}" fill="rgba(11, 61, 110, 0.12)"></path>
        <path d="${linePath}" fill="none" stroke="#0B3D6E" stroke-width="3" stroke-linecap="round"></path>
        ${markers}
        ${labels}
        ${dateLabels}
    `;
}

function buildWordPerformanceChart(assessment) {
    const container = document.getElementById('wordPerformanceChart');
    if (!container) return;

    const results = (assessment && assessment.word_results) ? assessment.word_results : [];
    if (results.length === 0) {
        container.innerHTML = '<div class="chart-empty">No word-level details available for the latest assessment.</div>';
        return;
    }

    const rows = results.slice(0, 12).map(result => {
        const word = result.word?.word || `Word ${result.word_id}`;
        const isCorrect = Boolean(result.is_correct);
        return `
            <div class="word-performance-row">
                <div class="word-performance-label">${escapeHtml(word)}</div>
                <div class="word-performance-track">
                    <div class="word-performance-fill ${isCorrect ? 'correct' : 'incorrect'}" style="width: 100%"></div>
                </div>
                <span class="word-performance-status ${isCorrect ? 'correct' : 'incorrect'}">${isCorrect ? '✓' : '✗'}</span>
            </div>
        `;
    }).join('');

    container.innerHTML = `<div class="word-chart-list">${rows}</div>`;
}

function renderHistory(assessments) {
    const tbody = dom.historyBody;
    const empty = dom.emptyHistory;

    tbody.innerHTML = '';

    if (assessments.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    const sorted = [...assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    sorted.forEach(assessment => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-50 transition';

        const date = new Date(assessment.created_at);
        const formattedDate = date.toLocaleDateString('en-PH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });

        const mastery = assessment.mastery_percentage || 0;
        const masteryColor = mastery >= 75 ? 'text-emerald-600' : mastery >= 50 ? 'text-yellow-600' : 'text-red-600';

        tr.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-600">${formattedDate}</td>
            <td class="px-6 py-4 text-sm text-gray-700 font-medium">${escapeHtml(assessment.level_tested) || '—'}</td>
            <td class="px-6 py-4 text-sm text-gray-600 text-center">${assessment.total_words || 0}</td>
            <td class="px-6 py-4 text-sm text-gray-600 text-center">${assessment.correct_count || 0}</td>
            <td class="px-6 py-4 text-sm font-bold text-center ${masteryColor}">${Math.round(mastery)}%</td>
            <td class="px-6 py-4 text-center">
                <button class="view-assessment-btn text-blue-600 hover:text-blue-800 text-sm font-medium transition" data-id="${assessment.id}">
                    📄 View
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.view-assessment-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const id = e.target.dataset.id;
            window.location.href = `/pages/assessmentSummary.html?assessmentId=${encodeURIComponent(id)}&learnerId=${encodeURIComponent(learnerId)}`;
        });
    });
}

function setLoading(loading) {
    dom.loadingSpinner.classList.toggle('hidden', !loading);
    dom.profileContent.classList.toggle('hidden', loading);
}

function showError(message) {
    dom.loadingSpinner.classList.add('hidden');
    dom.profileContent.classList.add('hidden');
    dom.errorState.classList.remove('hidden');
    dom.errorMessage.textContent = message;
}

// ============================================================
// 6. Start Assessment
// ============================================================

function startAssessment() {
    if (!learnerData) {
        alert('⚠️ Learner data not loaded. Please try again.');
        return;
    }

    const level = learnerData.current_level || 'Pre-Primer';
    const name = `${learnerData.first_name} ${learnerData.last_name}`;

    dom.startAssessmentBtn.disabled = true;
    dom.startAssessmentBtn.innerHTML = '⏳ Loading...';

    const url = `/pages/teacherAssessment.html?learnerId=${learnerData.id}&learnerName=${encodeURIComponent(name)}&level=${encodeURIComponent(level)}`;
    window.location.href = url;
}

// ============================================================
// 7. Get URL Parameters
// ============================================================

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        id: parseInt(params.get('id'), 10),
    };
}

// ============================================================
// 8. Initialisation
// ============================================================

async function init() {
    const params = getUrlParams();
    learnerId = params.id;

    if (!learnerId || isNaN(learnerId)) {
        showError('Invalid or missing learner ID. Please go back and try again.');
        return;
    }

    await checkBackendHealth();

    setLoading(true);
    try {
        const [learner, assessmentsData] = await Promise.all([
            fetchLearner(learnerId),
            fetchAssessments(learnerId),
        ]);

        learnerData = learner;
        assessments = assessmentsData;

        renderLearnerHeader(learnerData);
        renderStats(assessments);
        const sortedAssessments = [...assessments].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        buildMasteryChart(sortedAssessments);
        buildWordPerformanceChart(sortedAssessments[0] || null);
        renderHistory(assessments);

        dom.startAssessmentBtn.disabled = false;

        document.title = `${learnerData.first_name} ${learnerData.last_name} - Learner Profile`;

    } catch (error) {
        console.error('Failed to load profile:', error);
        showError(`Failed to load learner: ${error.message}`);
    } finally {
        setLoading(false);
    }
}

// ============================================================
// 9. Event Listeners
// ============================================================

dom.startAssessmentBtn.addEventListener('click', startAssessment);

// ============================================================
// 10. Start the app
// ============================================================

init();