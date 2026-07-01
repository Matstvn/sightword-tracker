// ============================================================
// utils.js - Shared frontend utilities
// ============================================================

/**
 * Escape a value for safe insertion into HTML markup via innerHTML.
 *
 * Converts &, <, >, ", ' into their HTML entity equivalents so that
 * DB-sourced text (learner names, LRNs, sight words, assessment
 * labels, etc.) can never be parsed as a tag/attribute, even if it
 * contains characters like < or " — it will just render as the
 * literal text the field actually holds.
 *
 * @param {*} value - Any value; non-strings are coerced with String().
 * @returns {string} The escaped string, or '' for null/undefined.
 */
export function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}