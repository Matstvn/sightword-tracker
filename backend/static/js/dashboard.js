// ============================================================
// dashboard.js - Main Dashboard Controller (Modern UI)
// ============================================================

// ============================================================
// 1. DOM References
// ============================================================
const dom = {
    statusBadge: document.getElementById('status-badge'),
    statusDot: document.getElementById('statusDot'),
    statusText: document.getElementById('statusText'),
    totalLearners: document.getElementById('totalLearners'),
    totalAssessments: document.getElementById('totalAssessments'),
    avgMastery: document.getElementById('avgMastery'),
    learnerGrid: document.getElementById('learnerGrid'),
    emptyState: document.getElementById('emptyState'),
    loadingSpinner: document.getElementById('loadingSpinner'),
    searchInput: document.getElementById('searchInput'),
    importBtn: document.getElementById('importBtn'),
    fileInput: document.getElementById('fileInput'),
};

// ============================================================
// 2. State
// ============================================================
let allLearners = [];

// ============================================================
// 3. API Calls
// ============================================================

async function fetchLearners() {
    const response = await fetch('/api/learners?limit=200');
    if (!response.ok) throw new Error(`Failed to fetch learners: ${response.statusText}`);
    return response.json();
}

async function deleteLearner(id) {
    const response = await fetch(`/api/learners/${id}`, { method: 'DELETE' });
    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Failed to delete learner');
    }
    return true;
}

async function checkBackendHealth() {
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        if (dom.statusDot) {
            dom.statusDot.className = 'dot online';
            dom.statusText.textContent = 'Backend: ' + data.status;
        }
        return true;
    } catch (error) {
        if (dom.statusDot) {
            dom.statusDot.className = 'dot offline';
            dom.statusText.textContent = 'Backend Offline';
        }
        console.error('Health check failed:', error);
        return false;
    }
}

// ============================================================
// 4. Rendering (Modern Cards)
// ============================================================

function renderLearners(learners) {
    const grid = dom.learnerGrid;
    const empty = dom.emptyState;

    grid.querySelectorAll('.learner-card').forEach(el => el.remove());

    if (learners.length === 0) {
        empty.classList.remove('hidden');
        return;
    }
    empty.classList.add('hidden');

    learners.forEach(learner => {
        const card = document.createElement('div');
        card.className = 'learner-card';

        const initial = (learner.first_name?.[0] || '?').toUpperCase();
        const displayLevel = learner.current_level || 'Pre-Primer';

        // Level badge color
        let levelClass = 'level-badge';
        if (displayLevel === 'Pre-Primer') levelClass += '';
        else if (displayLevel === 'Primer') levelClass += ' primed';
        else levelClass += ' advanced';

        card.innerHTML = `
            <div class="flex items-start justify-between">
                <div class="flex items-center gap-3">
                    <div class="avatar">${initial}</div>
                    <div>
                        <p class="name">${learner.first_name} ${learner.last_name}</p>
                        <p class="lrn">LRN: ${learner.lrn || '—'}</p>
                    </div>
                </div>
            </div>
            <div class="mt-2 flex items-center justify-between">
                <span class="${levelClass}">${displayLevel}</span>
            </div>
            <div class="actions">
                <button data-id="${learner.id}" class="btn-profile" title="View profile">👤</button>
                <button data-id="${learner.id}" class="btn-delete" title="Delete learner">🗑️</button>
            </div>
        `;
        grid.appendChild(card);
    });
}

function updateStats(learners) {
    dom.totalLearners.textContent = learners.length;
    dom.totalAssessments.textContent = '0';
    dom.avgMastery.textContent = '0%';
}

function setLoading(loading) {
    dom.loadingSpinner.classList.toggle('hidden', !loading);
}

function filterLearners(searchTerm) {
    if (!searchTerm.trim()) {
        renderLearners(allLearners);
        return;
    }
    const term = searchTerm.trim().toLowerCase();
    const filtered = allLearners.filter(l =>
        (l.first_name?.toLowerCase() || '').includes(term) ||
        (l.last_name?.toLowerCase() || '').includes(term) ||
        (l.lrn?.toLowerCase() || '').includes(term)
    );
    renderLearners(filtered);
}

// ============================================================
// 5. Toast Helper
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
// 6. Import SF1
// ============================================================

async function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(ext)) {
        showToast('❌ Please upload an Excel (.xlsx, .xls) or CSV file.', 'error');
        event.target.value = '';
        return;
    }

    const originalText = dom.importBtn.innerHTML;
    dom.importBtn.innerHTML = '⏳ Parsing...';
    dom.importBtn.disabled = true;

    try {
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        let headerIdx = -1;
        let gradeLevel = '';
        let section = '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowStr = row.map(cell => String(cell).toUpperCase()).join(' ');
            if (rowStr.includes('GRADE LEVEL')) {
                const nextCell = (i + 1 < rows.length) ? rows[i + 1] : [];
                const found = nextCell.find(cell => String(cell).trim() !== '');
                if (found) gradeLevel = String(found).trim();
            }
            if (rowStr.includes('SECTION')) {
                const nextCell = (i + 1 < rows.length) ? rows[i + 1] : [];
                const found = nextCell.find(cell => String(cell).trim() !== '');
                if (found) section = String(found).trim();
            }
            if (rowStr.includes('LRN') && rowStr.includes('NAME')) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx === -1) throw new Error('Could not find header row (LRN / NAME).');

        const headerRow = rows[headerIdx];
        const colIndex = {
            lrn: headerRow.findIndex(cell => String(cell).toUpperCase().includes('LRN')),
            name: headerRow.findIndex(cell => String(cell).toUpperCase().includes('NAME')),
            sex: headerRow.findIndex(cell => String(cell).toUpperCase().includes('SEX')),
        };
        if (colIndex.lrn === -1 || colIndex.name === -1) throw new Error('Could not find LRN or NAME columns.');

        const learners = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const lrn = String(row[colIndex.lrn] || '').trim();
            const name = String(row[colIndex.name] || '').trim();
            if (!lrn || !name) continue;
            const upperName = name.toUpperCase();
            if (upperName.includes('TOTAL MALE') || upperName.includes('TOTAL FEMALE') || upperName.includes('COMBINED') || upperName.includes('TOTAL')) {
                continue;
            }
            const parts = name.split(',');
            if (parts.length < 2) continue;
            const lastName = parts[0].trim();
            const firstAndMiddle = parts.slice(1).join(',').trim();
            const firstName = firstAndMiddle.split(' ')[0] || '';
            learners.push({
                lrn: lrn,
                first_name: firstName,
                last_name: lastName,
                grade_level: gradeLevel,
                section: section,
            });
        }

        if (learners.length === 0) throw new Error('No valid learners found in the file.');

        dom.importBtn.innerHTML = '⏳ Saving...';
        const response = await fetch('/api/learners/bulk', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(learners),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.detail || 'Bulk import failed');

        showToast(`✅ Imported ${result.imported} learners. Skipped ${result.skipped}.`, 'success');
        if (result.errors?.length > 0) {
            console.warn('Import errors:', result.errors);
            showToast(`⚠️ ${result.errors.length} row(s) had issues. Check console.`, 'warning');
        }
        await refreshLearners();

    } catch (error) {
        console.error('Import error:', error);
        showToast(`❌ ${error.message}`, 'error');
    } finally {
        dom.importBtn.innerHTML = originalText;
        dom.importBtn.disabled = false;
        event.target.value = '';
    }
}

async function refreshLearners() {
    setLoading(true);
    try {
        allLearners = await fetchLearners();
        renderLearners(allLearners);
        updateStats(allLearners);
    } catch (error) {
        console.error('Failed to refresh learners:', error);
        showToast('❌ Failed to refresh learner list.', 'error');
    } finally {
        setLoading(false);
    }
}

// ============================================================
// 7. Navigation & Delete
// ============================================================

function handleProfileClick(learnerId) {
    window.location.href = `/pages/learner.html?id=${learnerId}`;
}

async function handleDeleteClick(learnerId, learnerName) {
    if (!confirm(`Are you sure you want to delete ${learnerName}? This action cannot be undone.`)) return;
    try {
        await deleteLearner(learnerId);
        showToast(`🗑️ ${learnerName} has been deleted.`, 'success');
        await refreshLearners();
    } catch (error) {
        console.error('Delete error:', error);
        showToast(`❌ Failed to delete learner: ${error.message}`, 'error');
    }
}

// ============================================================
// 8. Initialisation
// ============================================================

async function init() {
    setLoading(true);
    const isHealthy = await checkBackendHealth();
    if (!isHealthy) {
        setLoading(false);
        dom.learnerGrid.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <h3 class="text-red-600">Cannot connect to backend</h3>
                <p>Please make sure FastAPI is running on port 8000.</p>
            </div>
        `;
        return;
    }
    await refreshLearners();
}

// ============================================================
// 9. Event Listeners
// ============================================================

let searchTimeout;
dom.searchInput.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterLearners(e.target.value), 200);
});

dom.importBtn.addEventListener('click', () => dom.fileInput.click());
dom.fileInput.addEventListener('change', importExcel);

dom.learnerGrid.addEventListener('click', (e) => {
    const profileBtn = e.target.closest('.btn-profile');
    if (profileBtn) {
        const id = parseInt(profileBtn.dataset.id, 10);
        handleProfileClick(id);
        return;
    }
    const deleteBtn = e.target.closest('.btn-delete');
    if (deleteBtn) {
        const id = parseInt(deleteBtn.dataset.id, 10);
        const card = deleteBtn.closest('.learner-card');
        const nameEl = card?.querySelector('.name');
        const name = nameEl ? nameEl.textContent.trim() : 'this learner';
        handleDeleteClick(id, name);
    }
});

// ============================================================
// 10. Start
// ============================================================

init();