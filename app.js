// app.js - Main Application Logic
// ================================================

import * as fb from './firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged,
    signOut as firebaseSignOut
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

// ================================================
// DOM ELEMENTS
// ================================================

const authScreen = document.getElementById('authScreen');
const profileSetupScreen = document.getElementById('profileSetupScreen');
const mainScreen = document.getElementById('mainScreen');
const loadingSpinner = document.getElementById('loadingSpinner');
const toast = document.getElementById('toast');

// Auth Elements
const authTabs = document.querySelectorAll('.auth-tab-btn');
const googleSignInBtn = document.getElementById('googleSignInBtn');
const emailAuthForm = document.getElementById('emailAuthForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');

// Profile Setup
const profileForm = document.getElementById('profileForm');
const profileName = document.getElementById('profileName');
const profilePhone = document.getElementById('profilePhone');
const profileAddress = document.getElementById('profileAddress');
const profileLandmark = document.getElementById('profileLandmark');

// Main App
const tabBtns = document.querySelectorAll('.tab-btn');
const navItems = document.querySelectorAll('.nav-item');
const tabContents = document.querySelectorAll('.tab-content');

// User Menu
const userMenuBtn = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
const userDisplayName = document.getElementById('userDisplayName');
const userDisplayEmail = document.getElementById('userDisplayEmail');
const editProfileBtn = document.getElementById('editProfileBtn');
const viewHistoryBtn = document.getElementById('viewHistoryBtn');
const logoutBtn = document.getElementById('logoutBtn');

// Booking Form
const bookingForm = document.getElementById('bookingForm');
const getLocationBtn = document.getElementById('getLocationBtn');
const locationStatus = document.getElementById('locationStatus');
const locationLat = document.getElementById('locationLat');
const locationLng = document.getElementById('locationLng');
const vehiclePhoto = document.getElementById('vehiclePhoto');
const photoPreview = document.getElementById('photoPreview');
const address = document.getElementById('address');
const bookingPhone = document.getElementById('bookingPhone');

// Status Tab
const statusContent = document.getElementById('statusContent');
const historyContent = document.getElementById('historyHistory');

// Install Banner
const installPrompt = document.getElementById('installPrompt');
const installBtn = document.getElementById('installBtn');
const dismissInstallBtn = document.getElementById('dismissInstallBtn');

// ================================================
// STATE MANAGEMENT
// ================================================

let currentUser = null;
let currentUserRole = 'user';
let currentUserData = null;
let currentLocationRequest = null;
let activeRequestListener = null;

// ================================================
// INITIALIZATION
// ================================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('App initialized');
    
    // Setup PWA
    setupPWA();
    
    // Setup auth state listener
    onAuthStateChanged(fb.auth, async (user) => {
        if (user) {
            currentUser = user;
            await handleUserSignedIn();
        } else {
            handleUserSignedOut();
        }
    });

    // Setup event listeners
    setupEventListeners();
});

// ================================================
// AUTH FLOW
// ================================================

function setupEventListeners() {
    // Auth tabs
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentUserRole = tab.dataset.role;
        });
    });

    // Google Sign In
    googleSignInBtn.addEventListener('click', () => {
        fb.setupGoogleSignIn(
            (user) => handleAuthSuccess(user),
            (error) => showToast(error.message, 'error')
        );
        window.google.accounts.id.renderButton(
            googleSignInBtn,
            { theme: 'outline', size: 'large', width: '100%' }
        );
        setTimeout(() => {
            const gsiFrame = document.querySelector('[data-client_id]');
            if (gsiFrame) gsiFrame.click();
        }, 100);
    });

    // Email Sign In
    emailAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);
        
        const email = authEmail.value.trim();
        const password = authPassword.value;

        try {
            let userCred;
            // Try sign in first
            try {
                userCred = await signInWithEmailAndPassword(fb.auth, email, password);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    // Create new account
                    userCred = await createUserWithEmailAndPassword(fb.auth, email, password);
                } else {
                    throw error;
                }
            }

            // Save user role
            await fb.saveUserProfile(userCred.user.uid, {
                email: email,
                role: currentUserRole,
                createdAt: new Date()
            });

            await handleAuthSuccess(userCred.user);
        } catch (error) {
            console.error('Auth error:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Profile Form
    profileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);

        try {
            const name = profileName.value.trim();
            const phone = profilePhone.value.trim();
            const userAddress = profileAddress.value.trim();
            const landmark = profileLandmark.value.trim();

            if (!fb.validatePhone(phone)) {
                showToast('Invalid phone number', 'error');
                showLoading(false);
                return;
            }

            await fb.saveUserProfile(currentUser.uid, {
                name: name,
                phone: phone,
                address: userAddress,
                landmark: landmark,
                role: currentUserRole
            });

            currentUserData = await fb.getUserProfile(currentUser.uid);
            showScreen('mainScreen');
            showToast('Profile saved successfully', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Booking Form
    bookingForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);

        try {
            const formData = new FormData(bookingForm);
            const lat = locationLat.value;
            const lng = locationLng.value;
            const userAddress = address.value.trim();
            const phone = bookingPhone.value.trim();

            if (!lat || !lng) {
                showToast('Please get your current location', 'error');
                showLoading(false);
                return;
            }

            if (!fb.validatePhone(phone)) {
                showToast('Invalid phone number', 'error');
                showLoading(false);
                return;
            }

            let photoUrl = null;
            if (vehiclePhoto.files.length > 0) {
                const file = vehiclePhoto.files[0];
                const path = `bookings/${currentUser.uid}/${Date.now()}`;
                const uploadResult = await fb.uploadImage(file, path);
                if (uploadResult.success) {
                    photoUrl = uploadResult.url;
                }
            }

            const bookingData = {
                userName: currentUserData.name || 'User',
                userPhone: phone,
                vehicleType: formData.get('vehicleType'),
                problemType: formData.get('problemType'),
                description: formData.get('description') || '',
                photoUrl: photoUrl,
                locationLat: parseFloat(lat),
                locationLng: parseFloat(lng),
                address: userAddress
            };

            const result = await fb.saveBookingRequest(currentUser.uid, bookingData);
            
            if (result.success) {
                showToast('Request submitted successfully! Mechanic will contact you soon.', 'success');
                bookingForm.reset();
                locationStatus.classList.remove('show', 'success', 'error');
                photoPreview.innerHTML = '';
                
                // Switch to status tab
                switchTab('status');
                loadActiveRequest();
            } else {
                showToast(result.error, 'error');
            }
        } catch (error) {
            console.error('Booking error:', error);
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Get Location
    getLocationBtn.addEventListener('click', async () => {
        showLoading(true);
        
        if (!navigator.geolocation) {
            showToast('Geolocation not supported', 'error');
            showLoading(false);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                locationLat.value = position.coords.latitude;
                locationLng.value = position.coords.longitude;
                
                locationStatus.classList.add('show', 'success');
                locationStatus.innerHTML = `
                    <strong>✓ Location obtained</strong><br>
                    Lat: ${position.coords.latitude.toFixed(4)}<br>
                    Lng: ${position.coords.longitude.toFixed(4)}
                `;
                
                showToast('Location updated', 'success');
                showLoading(false);
            },
            (error) => {
                locationStatus.classList.add('show', 'error');
                locationStatus.innerHTML = `<strong>✗ Location error:</strong> ${error.message}`;
                showToast('Could not get location', 'error');
                showLoading(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
            }
        );
    });

    // Vehicle Photo Preview
    vehiclePhoto.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                photoPreview.innerHTML = `<img src="${event.target.result}" alt="Vehicle photo">`;
            };
            reader.readAsDataURL(file);
        }
    });

    // Tab Navigation
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            switchTab(tabName);
        });
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            const tabName = item.dataset.tab;
            switchTab(tabName);
        });
    });

    // User Menu
    userMenuBtn.addEventListener('click', () => {
        userMenu.classList.toggle('hidden');
    });

    document.addEventListener('click', (e) => {
        if (!userMenuBtn.contains(e.target) && !userMenu.contains(e.target)) {
            userMenu.classList.add('hidden');
        }
    });

    editProfileBtn.addEventListener('click', () => {
        // TODO: Implement profile edit
        showToast('Profile editing coming soon', 'info');
        userMenu.classList.add('hidden');
    });

    viewHistoryBtn.addEventListener('click', () => {
        switchTab('history');
        userMenu.classList.add('hidden');
    });

    logoutBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            await firebaseSignOut(fb.auth);
            userMenu.classList.add('hidden');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Install Banner
    installBtn.addEventListener('click', async () => {
        if (window.deferredPrompt) {
            window.deferredPrompt.prompt();
            const { outcome } = await window.deferredPrompt.userChoice;
            if (outcome === 'accepted') {
                installPrompt.classList.add('hidden');
            }
            window.deferredPrompt = null;
        }
    });

    dismissInstallBtn.addEventListener('click', () => {
        installPrompt.classList.add('hidden');
    });
}

async function handleAuthSuccess(user) {
    try {
        const userProfile = await fb.getUserProfile(user.uid);
        
        if (!userProfile || !userProfile.name) {
            // Show profile setup
            showScreen('profileSetupScreen');
        } else {
            // Show main app
            currentUserData = userProfile;
            currentUserRole = userProfile.role || 'user';
            userDisplayName.textContent = userProfile.name;
            userDisplayEmail.textContent = user.email;
            bookingPhone.value = userProfile.phone || '';
            address.value = userProfile.address || '';
            
            showScreen('mainScreen');
            
            if (currentUserRole === 'user') {
                loadActiveRequest();
                setupRealtimeListener();
            }
        }
    } catch (error) {
        console.error('Auth success error:', error);
        showToast('Error loading profile', 'error');
    }
}

async function handleUserSignedIn() {
    try {
        const userProfile = await fb.getUserProfile(currentUser.uid);
        
        if (userProfile && userProfile.name) {
            currentUserData = userProfile;
            currentUserRole = userProfile.role || 'user';
            userDisplayName.textContent = userProfile.name;
            userDisplayEmail.textContent = currentUser.email;
            
            if (currentUserRole === 'user') {
                showScreen('mainScreen');
                loadActiveRequest();
                setupRealtimeListener();
            } else if (currentUserRole === 'mechanic') {
                // Redirect to mechanic page
                window.location.href = '/mechanic.html';
            } else if (currentUserRole === 'admin') {
                // Redirect to admin page
                window.location.href = '/admin.html';
            }
        } else {
            showScreen('profileSetupScreen');
        }
    } catch (error) {
        console.error('User signed in error:', error);
    }
}

function handleUserSignedOut() {
    currentUser = null;
    currentUserData = null;
    currentUserRole = 'user';
    
    if (activeRequestListener) {
        activeRequestListener();
    }
    
    authEmail.value = '';
    authPassword.value = '';
    profileForm.reset();
    bookingForm.reset();
    
    showScreen('authScreen');
}

// ================================================
// UI UTILITIES
// ================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(screen => {
        screen.classList.remove('active');
    });
    document.getElementById(screenId)?.classList.add('active');
}

function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });

    // Update nav items
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });

    // Update content
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    const contentId = `${tabName}Tab`;
    document.getElementById(contentId)?.classList.add('active');

    // Load data when switching to tabs
    if (tabName === 'status') {
        loadActiveRequest();
    } else if (tabName === 'history') {
        loadRequestHistory();
    }
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 3000);
}

function showLoading(show = true) {
    if (show) {
        loadingSpinner.classList.remove('hidden');
    } else {
        loadingSpinner.classList.add('hidden');
    }
}

// ================================================
// REQUEST MANAGEMENT
// ================================================

async function loadActiveRequest() {
    const request = await fb.getUserActiveRequest(currentUser.uid);
    
    if (request) {
        currentLocationRequest = request;
        displayStatusCard(request);
    } else {
        statusContent.innerHTML = '<p class="empty-state">No active requests</p>';
    }
}

function displayStatusCard(request) {
    const statusColors = {
        'Pending': 'pending',
        'Accepted': 'accepted',
        'Mechanic On The Way': 'active',
        'On The Way': 'active',
        'Work Started': 'active',
        'Completed': 'completed',
        'Cancelled': 'cancelled'
    };

    let timelineHTML = '';
    const statuses = ['Pending', 'Accepted', 'On The Way', 'Work Started', 'Completed'];
    const currentStatusIndex = statuses.indexOf(request.status);

    statuses.forEach((status, index) => {
        const isCompleted = index <= currentStatusIndex;
        const isCurrent = index === currentStatusIndex;
        
        timelineHTML += `
            <div class="timeline-step ${isCompleted ? 'completed' : ''}">
                <div class="timeline-icon">${isCurrent ? '📍' : isCompleted ? '✓' : ''}</div>
                <div class="timeline-content">
                    <h4>${status}</h4>
                    <p>${getStatusText(status)}</p>
                </div>
            </div>
        `;
    });

    let mechanicHTML = '';
    if (request.assignedMechanicId) {
        mechanicHTML = `
            <div class="mechanic-info">
                <div class="mechanic-header">
                    <div class="mechanic-avatar">🔧</div>
                    <div class="mechanic-details">
                        <h4>${request.mechanicName}</h4>
                        <p>📞 ${request.mechanicPhone}</p>
                        <p>Assigned</p>
                    </div>
                </div>
                <div class="mechanic-actions">
                    <button class="btn btn-primary btn-small" onclick="callMechanic('${request.mechanicPhone}')">
                        📞 Call
                    </button>
                    <button class="btn btn-secondary btn-small" onclick="whatsappMechanic('${request.mechanicPhone}')">
                        💬 WhatsApp
                    </button>
                </div>
            </div>
        `;
    }

    const requestDate = request.createdAt ? fb.formatDate(request.createdAt) : 'N/A';

    let cancelButton = '';
    if (request.status === 'Pending') {
        cancelButton = `
            <button class="btn btn-outline" onclick="cancelCurrentRequest('${request.requestId}')">
                ✕ Cancel Request
            </button>
        `;
    }

    statusContent.innerHTML = `
        <div class="status-card">
            <div class="status-header">
                <div>
                    <h3 class="status-title">${request.vehicleType} - ${request.problemType}</h3>
                    <p class="history-date">${requestDate}</p>
                </div>
                <span class="status-badge ${statusColors[request.status]}">${request.status}</span>
            </div>

            ${mechanicHTML}

            <div class="status-timeline">
                ${timelineHTML}
            </div>

            <div class="history-details">
                <div class="detail-row">
                    <span class="detail-label">Location</span>
                    <span class="detail-value">${request.address}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Description</span>
                    <span class="detail-value">${request.description || 'No details'}</span>
                </div>
            </div>

            ${cancelButton}

            ${request.status === 'Completed' ? `
                <div style="margin-top: 20px;">
                    <button class="btn btn-primary btn-large" onclick="showReviewForm('${request.requestId}', '${request.assignedMechanicId}')">
                        ⭐ Rate & Review
                    </button>
                </div>
            ` : ''}
        </div>
    `;
}

function getStatusText(status) {
    const statusTexts = {
        'Pending': 'Waiting for mechanic to accept',
        'Accepted': 'Mechanic has accepted your request',
        'On The Way': 'Mechanic is on the way to you',
        'Work Started': 'Mechanic is working on your vehicle',
        'Completed': 'Work completed'
    };
    return statusTexts[status] || status;
}

async function loadRequestHistory() {
    const requests = await fb.getUserRequestHistory(currentUser.uid);
    
    if (requests.length === 0) {
        historyContent.innerHTML = '<p class="empty-state">No request history</p>';
        return;
    }

    historyContent.innerHTML = requests.map(req => {
        const date = fb.formatDate(req.createdAt);
        const statusColors = {
            'Pending': 'pending',
            'Accepted': 'accepted',
            'On The Way': 'active',
            'Work Started': 'active',
            'Completed': 'completed',
            'Cancelled': 'cancelled'
        };

        return `
            <div class="history-card">
                <div class="history-header">
                    <div>
                        <h4>${req.vehicleType} - ${req.problemType}</h4>
                        <small class="history-date">${date}</small>
                    </div>
                    <span class="status-badge ${statusColors[req.status]}">${req.status}</span>
                </div>
                <div class="history-details">
                    <div class="detail-row">
                        <span class="detail-label">Address</span>
                        <span class="detail-value">${req.address}</span>
                    </div>
                    ${req.mechanicName ? `
                        <div class="detail-row">
                            <span class="detail-label">Mechanic</span>
                            <span class="detail-value">${req.mechanicName}</span>
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

async function cancelCurrentRequest(requestId) {
    if (!confirm('Are you sure you want to cancel this request?')) return;
    
    showLoading(true);
    const result = await fb.cancelRequest(requestId);
    showLoading(false);
    
    if (result.success) {
        showToast('Request cancelled', 'success');
        loadActiveRequest();
    } else {
        showToast(result.error, 'error');
    }
}

function setupRealtimeListener() {
    if (activeRequestListener) {
        activeRequestListener();
    }

    activeRequestListener = fb.listenToActiveRequest(currentUser.uid, (request) => {
        if (request) {
            currentLocationRequest = request;
            if (document.querySelector('.tab-content.active') === document.getElementById('statusTab')) {
                displayStatusCard(request);
            }
        }
    });
}

// ================================================
// ACTIONS
// ================================================

function callMechanic(phone) {
    window.location.href = `tel:${phone}`;
}

function whatsappMechanic(phone) {
    const cleanPhone = phone.replace(/\D/g, '');
    window.open(`https://wa.me/91${cleanPhone}`, '_blank');
}

function showReviewForm(requestId, mechanicId) {
    const reviewHTML = `
        <div class="form-container rating-section">
            <h3 class="form-title">Rate & Review</h3>
            <div class="rating-stars" id="ratingStars">
                ${[1,2,3,4,5].map(i => `
                    <span class="star" data-rating="${i}">⭐</span>
                `).join('')}
            </div>
            <textarea class="review-textarea" id="reviewText" placeholder="Share your experience..."></textarea>
            <button class="btn btn-primary btn-large" onclick="submitReview('${requestId}', '${mechanicId}')">
                Submit Review
            </button>
        </div>
    `;

    const reviewSection = statusContent.querySelector('.rating-section');
    if (reviewSection) {
        reviewSection.remove();
    }

    statusContent.insertAdjacentHTML('beforeend', reviewHTML);

    // Rating stars interaction
    document.querySelectorAll('.rating-stars .star').forEach(star => {
        star.addEventListener('click', function() {
            const rating = this.dataset.rating;
            document.querySelectorAll('.rating-stars .star').forEach((s, index) => {
                s.classList.toggle('active', index < rating);
            });
        });
    });
}

async function submitReview(requestId, mechanicId) {
    const ratingStars = document.querySelectorAll('.rating-stars .star.active');
    const rating = ratingStars.length;
    const reviewText = document.getElementById('reviewText').value.trim();

    if (rating === 0) {
        showToast('Please select a rating', 'error');
        return;
    }

    showLoading(true);
    const result = await fb.saveReview(currentUser.uid, mechanicId, requestId, rating, reviewText);
    showLoading(false);

    if (result.success) {
        showToast('Review submitted', 'success');
        loadActiveRequest();
    } else {
        showToast(result.error, 'error');
    }
}

// ================================================
// PWA SETUP
// ================================================

function setupPWA() {
    // Service Worker
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('service-worker.js')
            .then(reg => console.log('Service Worker registered'))
            .catch(err => console.log('Service Worker registration failed:', err));
    }

    // Install Prompt
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        window.deferredPrompt = e;
        
        // Show install banner
        if (currentUser) {
            installPrompt.classList.remove('hidden');
        }
    });

    window.addEventListener('appinstalled', () => {
        console.log('PWA installed');
        installPrompt.classList.add('hidden');
        window.deferredPrompt = null;
    });
}

// ================================================
// GLOBAL FUNCTIONS
// ================================================

window.callMechanic = callMechanic;
window.whatsappMechanic = whatsappMechanic;
window.cancelCurrentRequest = cancelCurrentRequest;
window.showReviewForm = showReviewForm;
window.submitReview = submitReview;
window.switchTab = switchTab;
