// Configuration
// Détection automatique: localhost ou Render
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000/api'  // Dev local
    : 'https://wbot-v1-2kt3.onrender.com/api'; // Production Render

// State
let currentStep = 1;
let currentPhoneNumber = '';
let currentSessionId = '';
let connectionCheckInterval = null;

// Elements
const phoneForm = document.getElementById('phoneForm');
const btnPairing = document.getElementById('btnPairing');
const btnQR = document.getElementById('btnQR');
const btnCopySession = document.getElementById('btnCopySession');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
});

function setupEventListeners() {
    // Phone form
    phoneForm?.addEventListener('submit', handlePhoneSubmit);

    // Method selection
    btnPairing?.addEventListener('click', () => handleMethodSelect('pairing'));
    btnQR?.addEventListener('click', () => handleMethodSelect('qr'));


    // Copy session ID
    btnCopySession?.addEventListener('click', copySessionId);

    // NEW: Copy Pairing Code
    const btnCopyPairingCode = document.getElementById('btnCopyPairingCode');
    btnCopyPairingCode?.addEventListener('click', () => {
        const code = document.getElementById('pairingCode').textContent;
        navigator.clipboard.writeText(code).then(() => {
            showNotification('Code copié !', 'success');
            btnCopyPairingCode.classList.add('copied');
            setTimeout(() => btnCopyPairingCode.classList.remove('copied'), 2000);
        });
    });
}

// Steps Navigation
function goToStep(step) {
    // Hide all steps
    document.querySelectorAll('.step').forEach(el => {
        el.classList.remove('active');
    });

    // Show target step
    const targetStep = document.getElementById(`step${step}`);
    if (targetStep) {
        targetStep.classList.add('active');
        currentStep = step;
    }
}

// Phone number submission
async function handlePhoneSubmit(e) {
    e.preventDefault();

    const phoneInput = document.getElementById('phoneNumber');
    const phoneNumber = phoneInput.value.trim();

    // Validation
    if (!/^[0-9]+$/.test(phoneNumber)) {
        showNotification('Numéro invalide. Utilisez uniquement des chiffres.', 'error');
        return;
    }

    if (phoneNumber.length < 10) {
        showNotification('Numéro trop court. Vérifiez le format.', 'error');
        return;
    }

    currentPhoneNumber = phoneNumber;
    goToStep(2);
}

// Method selection
async function handleMethodSelect(method) {
    goToStep(3);

    // Show loading
    document.getElementById('loadingState').style.display = 'block';
    document.getElementById('pairingCodeDisplay').style.display = 'none';
    document.getElementById('qrCodeDisplay').style.display = 'none';

    try {
        if (method === 'pairing') {
            await requestPairingCode();
        } else {
            await requestQRCode();
        }
    } catch (error) {
        console.error('Connection error:', error);
        showNotification('Erreur de connexion. Vérifiez le serveur.', 'error');
    }
}

// Request pairing code
async function requestPairingCode() {
    try {
        const response = await fetch(`${API_BASE_URL}/request-pairing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: currentPhoneNumber,
                method: 'pairing'
            })
        });

        if (!response.ok) {
            // Check for rate limit
            if (response.status === 429) {
                const data = await response.json();
                showNotification(data.error || 'Trop de requêtes. Attendez 5s.', 'error');
                goToStep(2); // Go back
                return;
            }
            throw new Error('Failed to request pairing code');
        }

        const data = await response.json();

        // Display pairing code
        document.getElementById('loadingState').style.display = 'none';
        document.getElementById('pairingCodeDisplay').style.display = 'block';
        document.getElementById('pairingCode').textContent = data.code || '----';

        // Store session ID
        currentSessionId = data.sessionId;

        // Start checking connection status
        startConnectionCheck();

    } catch (error) {
        console.error('Error requesting pairing code:', error);
        showNotification('Impossible de générer le code. Vérifiez le numéro.', 'error');
    }
}

// Helper to display pairing code (for QR fallback)
async function displayPairingCode(code, sessionId) {
    document.getElementById('loadingState').style.display = 'none';
    document.getElementById('pairingCodeDisplay').style.display = 'block';
    document.getElementById('pairingCode').textContent = code;
    currentSessionId = sessionId;
    startConnectionCheck();
}

// Request QR code
async function requestQRCode() {
    try {
        const response = await fetch(`${API_BASE_URL}/request-pairing`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                phoneNumber: currentPhoneNumber,
                method: 'qr'
            })
        });

        if (!response.ok) {
            // Check for rate limit
            if (response.status === 429) {
                const data = await response.json();
                showNotification(data.error || 'Trop de requêtes. Attendez 5s.', 'error');
                goToStep(2);
                return;
            }
            throw new Error('Failed to request QR code');
        }

        const data = await response.json();

        // Hide loading
        document.getElementById('loadingState').style.display = 'none';

        // Check if QR code image was generated
        if (data.qrImage) {
            // Display QR code
            document.getElementById('qrCodeDisplay').style.display = 'block';

            // Generate QR code using image
            const qrContainer = document.getElementById('qrCodeContainer');
            qrContainer.innerHTML = '';

            const img = document.createElement('img');
            img.src = data.qrImage;
            img.alt = 'QR Code WhatsApp';
            img.style.width = '300px';
            img.style.height = '300px';
            img.style.border = '2px solid rgba(255, 255, 255, 0.2)';
            img.style.borderRadius = '16px';
            img.style.padding = '10px';
            img.style.background = 'white';
            qrContainer.appendChild(img);

            // Store session ID
            currentSessionId = data.sessionId;

            // Start checking connection
            startConnectionCheck();

            // Update status text
            const statusText = document.getElementById('qrStatusText');
            if (statusText) statusText.textContent = "En attente de connexion...";
        } else if (data.code) {
            // 🔧 FIX: Disable auto-fallback. User wants QR.
            // Only show pairing code if we are NOT in strict QR mode (or if user switches)
            // For now, we treat this as a "Wait/Retry" scenario for QR
            if (method === 'qr') {
                console.log('Received pairing code but wanted QR. Ignoring/Retrying...');
                throw new Error('QR Code not fully generated yet. Retrying...');
            } else {
                await displayPairingCode(data.code, data.sessionId);
            }
        } else {
            throw new Error('No QR code received (Timeout)');
        }

    } catch (error) {
        console.error('Error requesting QR code:', error);
        showNotification('Impossible (Pour l\'instant). Utilisez le Code de Pairage.', 'error');
        goToStep(2);
    }
}

// Check connection status
let failureCount = 0; // Prevent infinite spam
function startConnectionCheck() {
    failureCount = 0;
    // Check every 2 seconds
    connectionCheckInterval = setInterval(async () => {
        try {
            const response = await fetch(`${API_BASE_URL}/session-status/${currentSessionId}`);

            if (!response.ok) {
                failureCount++;
                if (failureCount > 5) stopConnectionCheck(); // Stop after 5 fails
                return;
            }

            // Reset failure count on success
            failureCount = 0;
            const data = await response.json();

            if (data.connected && data.sessionId) {
                // Connection successful!
                stopConnectionCheck();
                handleConnectionSuccess(data);
            }
        } catch (error) {
            console.error('Error checking status (Server likely down):', error);
            failureCount++;
            if (failureCount > 5) {
                console.warn('⛔ Stopping connection check due to too many errors.');
                stopConnectionCheck();
                showNotification('Serveur injoignable. Relancez-le.', 'error');
            }
        }
    }, 2000);
}

function stopConnectionCheck() {
    if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
        connectionCheckInterval = null;
    }
}

// Handle successful connection
function handleConnectionSuccess(data) {
    // Display success information
    document.getElementById('displayPhone').textContent = currentPhoneNumber;
    document.getElementById('displaySessionId').textContent = data.sessionId;

    // Show success step
    goToStep(4);

    // Show success notification
    showNotification('✅ WBOT CONNECTÉ ! Vérifiez votre WhatsApp.', 'success');
}

// Copy session ID to clipboard
function copySessionId() {
    const sessionIdElement = document.getElementById('displaySessionId');
    const sessionId = sessionIdElement.textContent;

    navigator.clipboard.writeText(sessionId).then(() => {
        showNotification('SESSION_ID copié !', 'success');

        // Visual feedback
        const btn = btnCopySession;
        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<svg fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg>';
        btn.style.background = 'rgba(16, 185, 129, 0.3)';

        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        console.error('Copy failed:', err);
        showNotification('Erreur de copie', 'error');
    });
}

// Notification system
function showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    // Styles
    Object.assign(notification.style, {
        position: 'fixed',
        top: '20px',
        right: '20px',
        padding: '1rem 1.5rem',
        background: type === 'success' ? 'rgba(16, 185, 129, 0.9)' :
            type === 'error' ? 'rgba(239, 68, 68, 0.9)' :
                'rgba(59, 130, 246, 0.9)',
        color: 'white',
        borderRadius: '12px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.3)',
        zIndex: '10000',
        fontSize: '0.95rem',
        fontWeight: '500',
        maxWidth: '300px',
        animation: 'slideInRight 0.3s ease'
    });

    document.body.appendChild(notification);

    // Auto remove after 4 seconds
    setTimeout(() => {
        notification.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

// Add notification animations to document
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(400px);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(400px);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    stopConnectionCheck();
});
