// Check connection to the backend API
async function checkBackend() {
    const badge = document.getElementById('status-badge');
    try {
        const response = await fetch('/api/health');
        const data = await response.json();
        badge.innerHTML = '✅ Backend Connected';
        badge.className = 'px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium';
        console.log('Backend says:', data.message);
    } catch (error) {
        badge.innerHTML = '❌ Backend Offline';
        badge.className = 'px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium';
        console.error('Failed to connect to backend:', error);
    }
}

// Run when page loads
document.addEventListener('DOMContentLoaded', checkBackend);