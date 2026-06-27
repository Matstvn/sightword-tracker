// =============================================
// importer.js - Sight Word Tracker
// Client-side SF1 Importer (works with FastAPI backend)
// =============================================

/**
 * Parse the SF1 file and send the extracted learners to the backend.
 */
async function importExcel(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    const ext = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls'].includes(ext)) {
        alert('❌ Please upload an Excel file (.xlsx or .xls).');
        event.target.value = ''; // Reset input
        return;
    }

    try {
        // 1. Read the file using SheetJS
        const data = await file.arrayBuffer();
        const workbook = XLSX.read(data, { type: 'array' });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // 2. Find the header row that contains "LRN" and "NAME"
        let headerIdx = -1;
        let gradeLevel = '';
        let section = '';

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowStr = row.map(cell => String(cell).toUpperCase()).join(' ');

            // Look for Grade Level and Section from rows above the header
            if (rowStr.includes('GRADE LEVEL')) {
                // The value is usually in the next cell
                const nextCell = (i + 1 < rows.length) ? rows[i + 1] : [];
                const found = nextCell.find(cell => String(cell).trim() !== '');
                if (found) gradeLevel = String(found).trim();
            }
            if (rowStr.includes('SECTION')) {
                const nextCell = (i + 1 < rows.length) ? rows[i + 1] : [];
                const found = nextCell.find(cell => String(cell).trim() !== '');
                if (found) section = String(found).trim();
            }

            // Detect the header row
            if (rowStr.includes('LRN') && rowStr.includes('NAME')) {
                headerIdx = i;
                break;
            }
        }

        if (headerIdx === -1) {
            alert('❌ Could not find the header row (LRN / NAME). Please check the file.');
            event.target.value = '';
            return;
        }

        // 3. Extract column indices from the header row
        const headerRow = rows[headerIdx];
        const colIndex = {
            lrn: headerRow.findIndex(cell => String(cell).toUpperCase().includes('LRN')),
            name: headerRow.findIndex(cell => String(cell).toUpperCase().includes('NAME')),
            sex: headerRow.findIndex(cell => String(cell).toUpperCase().includes('SEX')),
        };

        if (colIndex.lrn === -1 || colIndex.name === -1) {
            alert('❌ Could not find LRN or NAME columns.');
            event.target.value = '';
            return;
        }

        // 4. Parse learner rows (starting after the header)
        const learners = [];
        for (let i = headerIdx + 1; i < rows.length; i++) {
            const row = rows[i];
            const lrn = String(row[colIndex.lrn] || '').trim();
            const name = String(row[colIndex.name] || '').trim();
            const sex = String(row[colIndex.sex] || '').trim();

            // Skip empty rows
            if (!lrn || !name) continue;

            // Skip summary rows (e.g., "TOTAL MALE", "TOTAL FEMALE", "COMBINED")
            const upperName = name.toUpperCase();
            if (
                upperName.includes('TOTAL MALE') ||
                upperName.includes('TOTAL FEMALE') ||
                upperName.includes('COMBINED') ||
                upperName.includes('TOTAL')
            ) {
                continue;
            }

            // Parse name: "LASTNAME, FIRSTNAME MIDDLENAME"
            const parts = name.split(',');
            if (parts.length < 2) continue; // skip malformed
            const lastName = parts[0].trim();
            const firstAndMiddle = parts.slice(1).join(',').trim();
            const firstName = firstAndMiddle.split(' ')[0] || ''; // take first part as first name

            learners.push({
                lrn: lrn,
                first_name: firstName,
                last_name: lastName,
                grade_level: gradeLevel,
                section: section,
                sex: sex, // (optional, not stored yet)
            });
        }

        if (learners.length === 0) {
            alert('⚠️ No valid learners found in the file.');
            event.target.value = '';
            return;
        }

        // 5. Send to the backend
        const response = await fetch('/api/learners/bulk', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(learners),
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.detail || 'Bulk import failed');
        }

        // 6. Show feedback
        alert(`✅ Successfully imported ${result.imported} learners.\nSkipped ${result.skipped} (duplicates or errors).`);
        if (result.errors && result.errors.length > 0) {
            console.warn('Import errors:', result.errors);
        }

        // 7. Refresh the dashboard (if using our dashboard)
        if (typeof refreshLearners === 'function') {
            await refreshLearners();
        } else {
            // Fallback: reload the page to show new learners
            window.location.reload();
        }

    } catch (error) {
        console.error('Import error:', error);
        alert(`❌ Failed to import: ${error.message}`);
    } finally {
        // Reset the file input so the same file can be re-uploaded
        event.target.value = '';
    }
}