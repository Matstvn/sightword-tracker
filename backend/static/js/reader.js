// ============================================================
// reader.js - Reader Display Controller (WebSocket Client)
// ============================================================

// ============================================================
// 1. DOM References
// ============================================================
const dom = {
    waitingState: document.getElementById('waitingState'),
    wordDisplay: document.getElementById('wordDisplay'),
    statusDot: document.getElementById('statusDot'),
};

// ============================================================
// 2. State
// ============================================================
let ws = null;
let learnerId = null;
let isConnected = false;

// ============================================================
// 3. Get URL Parameters
// ============================================================

function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        learnerId: params.get('learnerId'),
    };
}

// ============================================================
// 4. WebSocket Connection
// ============================================================

function connectWebSocket() {
    const params = getUrlParams();
    learnerId = params.learnerId;

    if (!learnerId) {
        dom.waitingState.innerHTML = `
            <div style="color: #ff4444; font-size: 2vw;">
                ⚠️ Missing learnerId parameter.
                <br>
                <span style="font-size: 1.2vw; color: #888;">
                    Please open this page with ?learnerId=123
                </span>
            </div>
        `;
        return;
    }

    // Build WebSocket URL
    // Use `wss://` if your site is served over HTTPS, otherwise `ws://`
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const room = `learner_${learnerId}`;
    const wsUrl = `${protocol}//${host}/ws/${room}`;

    console.log(`🔌 Connecting to WebSocket: ${wsUrl}`);
    dom.waitingState.innerHTML = `
        <div class="spinner"></div>
        <div>Connecting to ${room}...</div>
    `;

    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
        console.log('✅ WebSocket connected');
        isConnected = true;
        dom.statusDot.className = 'connected';
        dom.waitingState.innerHTML = `
            <div class="spinner"></div>
            <div>Waiting for Teacher...</div>
        `;
        // Show the word display area (blank until first word arrives)
        dom.wordDisplay.textContent = '👀';
        dom.wordDisplay.style.display = 'block';
        dom.waitingState.style.display = 'none';
    };

    ws.onmessage = (event) => {
        try {
            const message = JSON.parse(event.data);
            console.log('📨 Received:', message);

            switch (message.type) {
                case 'word':
                    // Display the word in giant text
                    dom.wordDisplay.textContent = message.word.toLowerCase();
                    dom.wordDisplay.style.display = 'block';
                    dom.waitingState.style.display = 'none';
                    break;

                case 'system':
                    // System message (e.g., disconnect notification)
                    console.log('📢 System:', message.message);
                    break;

                default:
                    console.log('Unknown message type:', message);
            }
        } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
        }
    };

    ws.onclose = (event) => {
        console.log('❌ WebSocket disconnected:', event.reason || 'No reason');
        isConnected = false;
        dom.statusDot.className = '';
        dom.waitingState.innerHTML = `
            <div style="color: #ff8844; font-size: 2vw;">
                ⚡ Connection lost.
                <br>
                <span style="font-size: 1.2vw; color: #888;">
                    Waiting to reconnect...
                </span>
            </div>
        `;
        dom.waitingState.style.display = 'block';
        dom.wordDisplay.style.display = 'none';

        // Attempt to reconnect after 3 seconds
        setTimeout(() => {
            console.log('🔄 Attempting to reconnect...');
            connectWebSocket();
        }, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        dom.waitingState.innerHTML = `
            <div style="color: #ff4444; font-size: 2vw;">
                ⚠️ WebSocket error.
                <br>
                <span style="font-size: 1.2vw; color: #888;">
                    Check console for details.
                </span>
            </div>
        `;
    };
}

// ============================================================
// 5. Keyboard Shortcuts (for testing)
// ============================================================

document.addEventListener('keydown', (e) => {
    // Press 'F' to toggle fullscreen (useful for Smart TV)
    if (e.key === 'f' || e.key === 'F') {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(err => {
                console.warn('Fullscreen not supported:', err);
            });
        } else {
            document.exitFullscreen().catch(err => {
                console.warn('Exit fullscreen failed:', err);
            });
        }
    }
});

// ============================================================
// 6. Start the app
// ============================================================

connectWebSocket();

// Log instructions
console.log('📖 Reader Display Instructions:');
console.log('  - Press "F" to toggle fullscreen.');
console.log('  - This page will update automatically when the teacher sends words.');
console.log(`  - Room: learner_${learnerId || 'unknown'}`);