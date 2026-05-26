// mechanic.js - Mechanic Dashboard Logic
// ================================================

import * as fb from './firebase.js';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';

// ================================================
// DOM ELEMENTS
// ================================================

const authScreen = document.getElementById('authScreen');
const profileSetupScreen = document.getElementById('profileSetupScreen');
const mainScreen = document.getElementById('mainScreen');
const loadingSpinner = document.getElementById('loadingSpinner');
const toast = document.getElementById('toast');

// Auth
const googleSignInBtn = document.getElementById('googleSignInBtn');
const emailAuthForm = document.getElementById('emailAuthForm');
const authEmail = document.getElementById('authEmail');
const authPassword = document.getElementById('authPassword');

// Profile Setup
const mechanicProfileForm = document.getElementById('mechanicProfileForm');

// Main App
const userMenuBtn = document.getElementById('userMenuBtn');
const userMenu = document.getElementById('userMenu');
const userDisplayName = document.getElementById('userDisplayName');
const userDisplayEmail = document.getElementById('userDisplayEmail');
const toggleOnlineBtn = document.getElementById('toggleOnlineBtn');
const logoutBtn = document.getElementById('logoutBtn');
const statusIndicator = document.getElementById('statusIndicator');
const statusText = document.getElementById('statusText');

// Tabs
const tabBtns = document.querySelectorAll('.tab-btn');
const navItems = document.querySelectorAll('.nav-item');

// Content
const requestsContent = document.getElementById('requestsContent');
const activeContent = document.getElementById('activeContent');
const completedContent = document.getElementById('completedContent');

// ================================================
// STATE
// ================================================

let currentUser = null;
let mechanicData = null;
let isOnline = false;
let mechanicLocation = null;
let requestsListener = null;
let activeJobsListener = null;

// ================================================
// INITIALIZATION
// ================================================

document.addEventListener('DOMContentLoaded', () => {
    onAuthStateChanged(fb.auth, async (user) => {
        if (user) {
            currentUser = user;
            await handleUserSignedIn();
        } else {
            handleUserSignedOut();
        }
    });

    setupEventListeners();
});

// ================================================
// EVENT LISTENERS
// ================================================

function setupEventListeners() {
    // Auth
    googleSignInBtn.addEventListener('click', () => {
        fb.setupGoogleSignIn(
            (user) => handleAuthSuccess(user),
            (error) => showToast(error.message, 'error')
        );
        window.google.accounts.id.renderButton(googleSignInBtn, { theme: 'outline', size: 'large' });
        setTimeout(() => {
            const gsiFrame = document.querySelector('[data-client_id]');
            if (gsiFrame) gsiFrame.click();
        }, 100);
    });

    emailAuthForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);

        try {
            let userCred;
            try {
                userCred = await signInWithEmailAndPassword(fb.auth, authEmail.value, authPassword.value);
            } catch (error) {
                if (error.code === 'auth/user-not-found') {
                    userCred = await createUserWithEmailAndPassword(fb.auth, authEmail.value, authPassword.value);
                } else {
                    throw error;
                }
            }

            await fb.saveMechanicProfile(userCred.user.uid, {
                email: authEmail.value,
                role: 'mechanic'
            });

            await handleAuthSuccess(userCred.user);
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Profile Setup
    mechanicProfileForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        showLoading(true);

        try {
            const vehicleTypes = Array.from(
                document.querySelectorAll('input[name="vehicleTypes"]:checked')
            ).map(el => el.value);

            if (vehicleTypes.length === 0) {
                showToast('Select at least one vehicle type', 'error');
                showLoading(false);
                return;
            }

            await fb.saveMechanicProfile(currentUser.uid, {
                name: document.getElementById('mechanicName').value,
                phone: document.getElementById('mechanicPhone').value,
                experience: parseInt(document.getElementById('experience').value),
                vehicleTypes: vehicleTypes,
                serviceArea: parseInt(document.getElementById('serviceArea').value),
                role: 'mechanic'
            });

            mechanicData = await fb.getMechanicProfile(currentUser.uid);
            showScreen('mainScreen');
            loadNearbyRequests();
            showToast('Profile saved!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
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

    toggleOnlineBtn.addEventListener('click', async () => {
        isOnline = !isOnline;
        await updateOnlineStatus();
        userMenu.classList.add('hidden');
    });

    logoutBtn.addEventListener('click', async () => {
        showLoading(true);
        try {
            await fb.signOut();
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            showLoading(false);
        }
    });

    // Tabs
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            switchTab(btn.dataset.tab);
        });
    });

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            switchTab(item.dataset.tab);
        });
    });
}

// ================================================
// AUTH FLOW
// ================================================

async function handleAuthSuccess(user) {
    const profile = await fb.getMechanicProfile(user.uid);

    if (!profile || !profile.name) {
        showScreen('profileSetupScreen');
    } else {
        mechanicData = profile;
        userDisplayName.textContent = profile.name;
        userDisplayEmail.textContent = user.email;
        isOnline = profile.isOnline || false;
        updateOnlineIndicator();
        showScreen('mainScreen');
        getMechanicLocation();
        loadNearbyRequests();
        loadActiveJobs();
        setupListeners();
    }
}

async function handleUserSignedIn() {
    const profile = await fb.getMechanicProfile(currentUser.uid);

    if (profile && profile.name) {
        mechanicData = profile;
        userDisplayName.textContent = profile.name;
        userDisplayEmail.textContent = currentUser.email;
        isOnline = profile.isOnline || false;
        updateOnlineIndicator();
        showScreen('mainScreen');
        getMechanicLocation();
        loadNearbyRequests();
        loadActiveJobs();
        setupListeners();
    } else {
        showScreen('profileSetupScreen');
    }
}

function handleUserSignedOut() {
    currentUser = null;
    mechanicData = null;
    authEmail.value = '';
    authPassword.value = '';
    if (requestsListener) requestsListener();
    if (activeJobsListener) activeJobsListener();
    showScreen('authScreen');
}

// ================================================
// UI UTILITIES
// ================================================

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId)?.classList.add('active');
}

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
        content.classList.remove('active');
    });

    document.getElementById(`${tabName}Tab`)?.classList.add('active');

    if (tabName === 'active') {
        loadActiveJobs();
    } else if (tabName === 'completed') {
        loadCompletedJobs();
    }
}

function showToast(message, type = 'info') {
    toast.textContent = message;
    toast.className = `toast ${type}`;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
}

function showLoading(show = true) {
    loadingSpinner.classList.toggle('hidden', !show);
}

// ================================================
// LOCATION & STATUS
// ================================================

function getMechanicLocation() {
    if (!navigator.geolocation) {
        showToast('Geolocation not supported', 'error');
        return;
    }

    navigator.geolocation.watchPosition(
        (position) => {
            mechanicLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            loadNearbyRequests();
        },
        (error) => {
            console.log('Location error:', error);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
    );
}

async function updateOnlineStatus() {
    try {
        const updateData = {};
        updateData[`mechanicData.isOnline`] = isOnline;
        
        // Update in Firestore
        const { updateDoc, doc } = await import(
            'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js'
        );
        await updateDoc(doc(fb.db, 'mechanics', currentUser.uid), { isOnline: isOnline });
        
        updateOnlineIndicator();
        showToast(isOnline ? 'You are online' : 'You are offline', 'success');
        loadNearbyRequests();
    } catch (error) {
        showToast(error.message, 'error');
        isOnline = !isOnline;
    }
}

function updateOnlineIndicator() {
    if (isOnline) {
        statusIndicator.style.background = '#16A34A';
        statusText.textContent = 'Online';
        toggleOnlineBtn.textContent = '🔴 Go Offline';
    } else {
        statusIndicator.style.background = '#EF4444';
        statusText.textContent = 'Offline';
        toggleOnlineBtn.textContent = '🟢 Go Online';
    }
}

// ================================================
// LOAD DATA
// ================================================

async function loadNearbyRequests() {
    if (!isOnline || !mechanicLocation) {
        requestsContent.innerHTML = '<p class="empty-state">Go online to see requests</p>';
        return;
    }

    try {
        const requests = await fb.getNearbyPendingRequests(
            mechanicLocation.lat,
            mechanicLocation.lng,
            mechanicData.serviceArea || 10
        );

        if (requests.length === 0) {
            requestsContent.innerHTML = '<p class="empty-state">No nearby requests</p>';
            return;
        }

        requestsContent.innerHTML = requests.map(req => {
            const date = fb.formatDate(req.createdAt);
            const distance = (req.distance || 0).toFixed(1);

            return `
                <div class="status-card" style="margin-bottom: 20px;">
                    <div class="status-header">
                        <div>
                            <h4>${req.vehicleType} - ${req.problemType}</h4>
                            <small class="history-date">${date}</small>
                        </div>
                        <span style="background: #FCD34D; color: #78350F; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 700;">
                            ${distance} km
                        </span>
                    </div>
                    <div class="history-details">
                        <div class="detail-row">
                            <span class="detail-label">Customer</span>
                            <span class="detail-value">${req.userName} • ${req.userPhone}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${req.address}</span>
                        </div>
                        ${req.description ? `
                            <div class="detail-row">
                                <span class="detail-label">Details</span>
                                <span class="detail-value">${req.description}</span>
                            </div>
                        ` : ''}
                    </div>
                    <button class="btn btn-primary btn-large" style="margin-top: 15px;" onclick="acceptRequest('${req.requestId}')">
                        ✓ Accept Job
                    </button>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Load requests error:', error);
        requestsContent.innerHTML = '<p class="empty-state">Error loading requests</p>';
    }
}

async function loadActiveJobs() {
    try {
        const jobs = await fb.getMechanicAssignedRequests(currentUser.uid);

        if (jobs.length === 0) {
            activeContent.innerHTML = '<p class="empty-state">No active jobs</p>';
            return;
        }

        activeContent.innerHTML = jobs.map(job => {
            const date = fb.formatDate(job.createdAt);
            const statusColors = {
                'Accepted': 'accepted',
                'On The Way': 'active',
                'Work Started': 'active'
            };

            return `
                <div class="status-card" style="margin-bottom: 20px;">
                    <div class="status-header">
                        <div>
                            <h4>${job.vehicleType} - ${job.problemType}</h4>
                            <small class="history-date">${date}</small>
                        </div>
                        <span class="status-badge ${statusColors[job.status]}">${job.status}</span>
                    </div>
                    <div class="history-details">
                        <div class="detail-row">
                            <span class="detail-label">Customer</span>
                            <span class="detail-value">${job.userName} • ${job.userPhone}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Location</span>
                            <span class="detail-value">${job.address}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 10px; margin-top: 15px;">
                        ${job.status === 'Accepted' ? `
                            <button class="btn btn-secondary btn-small" style="flex: 1;" onclick="updateJobStatus('${job.requestId}', 'On The Way')">
                                🚗 On The Way
                            </button>
                        ` : ''}
                        ${job.status === 'On The Way' ? `
                            <button class="btn btn-secondary btn-small" style="flex: 1;" onclick="updateJobStatus('${job.requestId}', 'Work Started')">
                                🔧 Start Work
                            </button>
                        ` : ''}
                        ${job.status === 'Work Started' ? `
                            <button class="btn btn-primary btn-small" style="flex: 1;" onclick="updateJobStatus('${job.requestId}', 'Completed')">
                                ✓ Complete
                            </button>
                        ` : ''}
                        <button class="btn btn-outline btn-small" style="flex: 1;" onclick="callCustomer('${job.userPhone}')">
                            📞 Call
                        </button>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Load active jobs error:', error);
        activeContent.innerHTML = '<p class="empty-state">Error loading jobs</p>';
    }
}

async function loadCompletedJobs() {
    try {
        const jobs = await fb.getMechanicCompletedJobs(currentUser.uid);

        if (jobs.length === 0) {
            completedContent.innerHTML = '<p class="empty-state">No completed jobs</p>';
            return;
        }

        completedContent.innerHTML = jobs.map(job => {
            const date = fb.formatDate(job.createdAt);

            return `
                <div class="status-card" style="margin-bottom: 20px;">
                    <div class="status-header">
                        <div>
                            <h4>${job.vehicleType} - ${job.problemType}</h4>
                            <small class="history-date">${date}</small>
                        </div>
                        <span class="status-badge completed">✓ Completed</span>
                    </div>
                    <div class="history-details">
                        <div class="detail-row">
                            <span class="detail-label">Customer</span>
                            <span class="detail-value">${job.userName}</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    } catch (error) {
        console.error('Load completed jobs error:', error);
        completedContent.innerHTML = '<p class="empty-state">Error loading jobs</p>';
    }
}

function setupListeners() {
    // Real-time active jobs updates
    if (activeJobsListener) activeJobsListener();
    
    // You can set up real-time listeners here if needed
}

// ================================================
// ACTIONS
// ================================================

async function acceptRequest(requestId) {
    if (!confirm('Accept this job?')) return;

    showLoading(true);
    try {
        const result = await fb.acceptRequest(
            requestId,
            currentUser.uid,
            mechanicData.name,
            mechanicData.phone
        );

        if (result.success) {
            showToast('Job accepted!', 'success');
            loadNearbyRequests();
            loadActiveJobs();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

async function updateJobStatus(requestId, newStatus) {
    showLoading(true);
    try {
        const result = await fb.updateRequestStatus(requestId, newStatus);

        if (result.success) {
            showToast(`Status updated to ${newStatus}`, 'success');
            loadActiveJobs();
        } else {
            showToast(result.error, 'error');
        }
    } catch (error) {
        showToast(error.message, 'error');
    } finally {
        showLoading(false);
    }
}

function callCustomer(phone) {
    window.location.href = `tel:${phone}`;
}

// ================================================
// GLOBAL FUNCTIONS
// ================================================

window.acceptRequest = acceptRequest;
window.updateJobStatus = updateJobStatus;
window.callCustomer = callCustomer;
