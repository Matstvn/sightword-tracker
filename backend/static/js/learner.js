// ============================================================
// learner.js - Learner Profile Controller
// ============================================================

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
            <td class="px-6 py-4 text-sm text-gray-700 font-medium">${assessment.level_tested || '—'}</td>
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
            alert(`📄 Assessment #${id} details will be available in the next update.`);
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