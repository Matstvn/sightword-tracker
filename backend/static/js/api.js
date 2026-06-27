// ============================================================
// api.js - Communication layer with FastAPI backend
// ============================================================

const API_BASE = '/api';

export const api = {

    /**
     * Fetch sight words by level or by a list of IDs.
     * @param {Object} options
     * @param {string} options.level - e.g., 'Pre-Primer'
     * @param {string} options.ids - comma-separated IDs, e.g., '1,2,3'
     */
    async getWords({ level, ids } = {}) {
        let url = `${API_BASE}/words?`;
        if (level) url += `level=${encodeURIComponent(level)}&`;
        if (ids) url += `ids=${encodeURIComponent(ids)}&`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch words: ${response.statusText}`);
        }
        return response.json();
    },

    async getLearner(learnerId) {
        const url = `${API_BASE}/learners/${learnerId}`;
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch learner: ${response.statusText}`);
        }
        return response.json();
    },

    async saveAssessment(assessmentData) {
        const response = await fetch(`${API_BASE}/assessments`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(assessmentData),
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to save assessment: ${errorText}`);
        }
        return response.json();
    }
};