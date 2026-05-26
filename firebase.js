// firebase.js - Firebase Configuration & Utilities
// ======================================================

import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-app.js';
import { getAuth, signOut as firebaseSignOut } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js';

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyBfSfeiOmyBSyYBTV87OKH6IqFU0YXemw0",
    authDomain: "ayur-620e7.firebaseapp.com",
    projectId: "ayur-620e7",
    storageBucket: "ayur-620e7.firebasestorage.app",
    messagingSenderId: "732502202884",
    appId: "1:732502202884:web:18ff4c790235049d743351",
    measurementId: "G-395G8H08YV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export Firebase Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

// ======================================================
// AUTHENTICATION UTILITIES
// ======================================================

/**
 * Sign out user
 */
export async function signOut() {
    try {
        await firebaseSignOut(auth);
        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current user
 */
export function getCurrentUser() {
    return auth.currentUser;
}

/**
 * Set auth persistence
 */
export async function setPersistence() {
    try {
        const { setPersistence, browserLocalPersistence } = await import(
            'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js'
        );
        await setPersistence(auth, browserLocalPersistence);
        return true;
    } catch (error) {
        console.error('Persistence error:', error);
        return false;
    }
}

// ======================================================
// FIRESTORE UTILITIES
// ======================================================

import {
    collection,
    doc,
    setDoc,
    getDoc,
    getDocs,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    limit,
    startAfter,
    onSnapshot,
    serverTimestamp,
    writeBatch
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-firestore.js';

/**
 * Add/Update User Profile
 */
export async function saveUserProfile(userId, userData) {
    try {
        const userRef = doc(db, 'users', userId);
        await setDoc(userRef, {
            ...userData,
            updatedAt: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Save user error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get User Profile
 */
export async function getUserProfile(userId) {
    try {
        const userRef = doc(db, 'users', userId);
        const userSnap = await getDoc(userRef);
        return userSnap.exists() ? userSnap.data() : null;
    } catch (error) {
        console.error('Get user error:', error);
        return null;
    }
}

/**
 * Save Booking Request
 */
export async function saveBookingRequest(userId, requestData) {
    try {
        const requestRef = doc(collection(db, 'requests'));
        await setDoc(requestRef, {
            requestId: requestRef.id,
            userId: userId,
            ...requestData,
            status: 'Pending',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });
        return { success: true, requestId: requestRef.id };
    } catch (error) {
        console.error('Save booking error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get User's Active Request
 */
export async function getUserActiveRequest(userId) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('userId', '==', userId),
            where('status', 'in', ['Pending', 'Accepted', 'On The Way', 'Work Started']),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const querySnap = await getDocs(q);
        return querySnap.empty ? null : querySnap.docs[0].data();
    } catch (error) {
        console.error('Get active request error:', error);
        return null;
    }
}

/**
 * Listen to User's Active Request (Realtime)
 */
export function listenToActiveRequest(userId, callback) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('userId', '==', userId),
            where('status', 'in', ['Pending', 'Accepted', 'On The Way', 'Work Started']),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        
        return onSnapshot(q, (snapshot) => {
            if (snapshot.empty) {
                callback(null);
            } else {
                callback(snapshot.docs[0].data());
            }
        }, (error) => {
            console.error('Listen error:', error);
            callback(null);
        });
    } catch (error) {
        console.error('Listen setup error:', error);
    }
}

/**
 * Get User's Request History
 */
export async function getUserRequestHistory(userId) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('userId', '==', userId),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get history error:', error);
        return [];
    }
}

/**
 * Cancel Booking Request
 */
export async function cancelRequest(requestId) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'Cancelled',
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Cancel request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save Review & Rating
 */
export async function saveReview(userId, mechanicId, requestId, rating, reviewText) {
    try {
        const reviewRef = doc(collection(db, 'reviews'));
        await setDoc(reviewRef, {
            userId: userId,
            mechanicId: mechanicId,
            requestId: requestId,
            rating: rating,
            review: reviewText,
            createdAt: serverTimestamp()
        });

        // Update mechanic rating
        const mechanicRef = doc(db, 'mechanics', mechanicId);
        const mechanicSnap = await getDoc(mechanicRef);
        if (mechanicSnap.exists()) {
            const data = mechanicSnap.data();
            const newRating = (data.rating || 0 + rating) / 2;
            await updateDoc(mechanicRef, { rating: newRating });
        }

        return { success: true };
    } catch (error) {
        console.error('Save review error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Save Mechanic Profile
 */
export async function saveMechanicProfile(userId, mechanicData) {
    try {
        const mechanicRef = doc(db, 'mechanics', userId);
        await setDoc(mechanicRef, {
            uid: userId,
            ...mechanicData,
            isApproved: false,
            isOnline: false,
            rating: 0,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        }, { merge: true });
        return { success: true };
    } catch (error) {
        console.error('Save mechanic error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Mechanic Profile
 */
export async function getMechanicProfile(mechanicId) {
    try {
        const mechanicRef = doc(db, 'mechanics', mechanicId);
        const mechanicSnap = await getDoc(mechanicRef);
        return mechanicSnap.exists() ? mechanicSnap.data() : null;
    } catch (error) {
        console.error('Get mechanic error:', error);
        return null;
    }
}

/**
 * Get Nearby Pending Requests for Mechanic
 */
export async function getNearbyPendingRequests(latitude, longitude, radiusKm = 10) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('status', '==', 'Pending'),
            orderBy('createdAt', 'desc')
        );
        
        const querySnap = await getDocs(q);
        const requests = querySnap.docs.map(doc => {
            const data = doc.data();
            const distance = calculateDistance(
                latitude, longitude,
                data.locationLat, data.locationLng
            );
            return { ...data, distance };
        });

        // Filter by radius
        return requests.filter(req => req.distance <= radiusKm).sort((a, b) => a.distance - b.distance);
    } catch (error) {
        console.error('Get nearby requests error:', error);
        return [];
    }
}

/**
 * Accept Request by Mechanic
 */
export async function acceptRequest(requestId, mechanicId, mechanicName, mechanicPhone) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: 'Accepted',
            assignedMechanicId: mechanicId,
            mechanicName: mechanicName,
            mechanicPhone: mechanicPhone,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Accept request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Update Request Status
 */
export async function updateRequestStatus(requestId, newStatus) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            status: newStatus,
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Update status error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Mechanic's Assigned Requests
 */
export async function getMechanicAssignedRequests(mechanicId) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('assignedMechanicId', '==', mechanicId),
            where('status', 'in', ['Accepted', 'On The Way', 'Work Started']),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get assigned requests error:', error);
        return [];
    }
}

/**
 * Get Mechanic's Completed Jobs
 */
export async function getMechanicCompletedJobs(mechanicId) {
    try {
        const q = query(
            collection(db, 'requests'),
            where('assignedMechanicId', '==', mechanicId),
            where('status', '==', 'Completed'),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get completed jobs error:', error);
        return [];
    }
}

/**
 * Get All Users (Admin)
 */
export async function getAllUsers() {
    try {
        const q = query(
            collection(db, 'users'),
            where('role', '==', 'user'),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get users error:', error);
        return [];
    }
}

/**
 * Get All Mechanics (Admin)
 */
export async function getAllMechanics() {
    try {
        const q = query(
            collection(db, 'mechanics'),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get mechanics error:', error);
        return [];
    }
}

/**
 * Approve Mechanic (Admin)
 */
export async function approveMechanic(mechanicId) {
    try {
        const mechanicRef = doc(db, 'mechanics', mechanicId);
        await updateDoc(mechanicRef, { isApproved: true });
        return { success: true };
    } catch (error) {
        console.error('Approve mechanic error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get All Requests (Admin)
 */
export async function getAllRequests() {
    try {
        const q = query(
            collection(db, 'requests'),
            orderBy('createdAt', 'desc')
        );
        const querySnap = await getDocs(q);
        return querySnap.docs.map(doc => doc.data());
    } catch (error) {
        console.error('Get all requests error:', error);
        return [];
    }
}

/**
 * Delete Request (Admin)
 */
export async function deleteRequest(requestId) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await deleteDoc(requestRef);
        return { success: true };
    } catch (error) {
        console.error('Delete request error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Assign Mechanic to Request (Admin)
 */
export async function assignMechanicToRequest(requestId, mechanicId, mechanicName, mechanicPhone) {
    try {
        const requestRef = doc(db, 'requests', requestId);
        await updateDoc(requestRef, {
            assignedMechanicId: mechanicId,
            mechanicName: mechanicName,
            mechanicPhone: mechanicPhone,
            status: 'Accepted',
            updatedAt: serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error('Assign mechanic error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Dashboard Stats (Admin)
 */
export async function getDashboardStats() {
    try {
        const usersSnap = await getDocs(query(
            collection(db, 'users'),
            where('role', '==', 'user')
        ));
        
        const mechanicsSnap = await getDocs(collection(db, 'mechanics'));
        
        const pendingSnap = await getDocs(query(
            collection(db, 'requests'),
            where('status', '==', 'Pending')
        ));
        
        const completedSnap = await getDocs(query(
            collection(db, 'requests'),
            where('status', '==', 'Completed')
        ));

        return {
            totalUsers: usersSnap.size,
            totalMechanics: mechanicsSnap.size,
            pendingRequests: pendingSnap.size,
            completedJobs: completedSnap.size
        };
    } catch (error) {
        console.error('Dashboard stats error:', error);
        return { totalUsers: 0, totalMechanics: 0, pendingRequests: 0, completedJobs: 0 };
    }
}

// ======================================================
// STORAGE UTILITIES
// ======================================================

import {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
} from 'https://www.gstatic.com/firebasejs/12.13.0/firebase-storage.js';

/**
 * Upload Image to Firebase Storage
 */
export async function uploadImage(file, path) {
    try {
        const storageRef = ref(storage, path);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        return { success: true, url: downloadURL };
    } catch (error) {
        console.error('Upload error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete Image from Storage
 */
export async function deleteImage(path) {
    try {
        const storageRef = ref(storage, path);
        await deleteObject(storageRef);
        return { success: true };
    } catch (error) {
        console.error('Delete error:', error);
        return { success: false, error: error.message };
    }
}

// ======================================================
// UTILITY FUNCTIONS
// ======================================================

/**
 * Calculate distance between two coordinates (Haversine formula)
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Format timestamp to readable date
 */
export function formatDate(timestamp) {
    if (!timestamp) return 'N/A';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

/**
 * Validate Email
 */
export function validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate Phone
 */
export function validatePhone(phone) {
    const re = /^[0-9]{10}$/;
    return re.test(phone.replace(/\D/g, ''));
}

// ======================================================
// GOOGLE AUTHENTICATION SETUP
// ======================================================

export function setupGoogleSignIn(onSuccess, onError) {
    window.google.accounts.id.initialize({
        client_id: '1:732502202884:web:18ff4c790235049d743351',
        callback: handleGoogleSignIn(onSuccess, onError)
    });
}

function handleGoogleSignIn(onSuccess, onError) {
    return async (response) => {
        try {
            const { GoogleAuthProvider, signInWithCredential } = await import(
                'https://www.gstatic.com/firebasejs/12.13.0/firebase-auth.js'
            );
            
            const credential = GoogleAuthProvider.credential(response.credential);
            const result = await signInWithCredential(auth, credential);
            
            onSuccess(result.user);
        } catch (error) {
            console.error('Google sign-in error:', error);
            onError(error);
        }
    };
}
