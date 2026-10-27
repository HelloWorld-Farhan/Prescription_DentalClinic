import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';

const firebaseConfig = {
  apiKey: (import.meta as any).env?.VITE_FIREBASE_API_KEY || '',
  authDomain: (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMAIN || (import.meta as any).env?.VITE_FIREBASE_AUTH_DOMA || '',
  projectId: (import.meta as any).env?.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: (import.meta as any).env?.VITE_FIREBASE_STORAGE_BUCKET || (import.meta as any).env?.VITE_FIREBASE_STORAGE_BU || '',
  messagingSenderId: (import.meta as any).env?.VITE_FIREBASE_MESSAGING_SENDER_ID || (import.meta as any).env?.VITE_FIREBASE_MESSAGING_ || '',
  appId: (import.meta as any).env?.VITE_FIREBASE_APP_ID || '',
  measurementId: (import.meta as any).env?.VITE_FIREBASE_MEASUREMENT_ID || (import.meta as any).env?.VITE_FIREBASE_MEASUREME || ''
};

// Initialize Firebase App singleton safely
const app = getApps().length > 0 ? getApp() : (firebaseConfig.apiKey ? initializeApp(firebaseConfig) : null);
export const auth = app ? getAuth(app) : (null as any);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account'
});

export interface GoogleAuthResult {
  idToken: string;
  email: string;
  fullName: string;
  photoUrl?: string;
}

/**
 * Triggers 1-Click Google Sign-In popup with Firebase
 * Supports loginHintEmail to preselect or restrict OAuth to that exact account.
 */
export async function signInWithGooglePopup(loginHintEmail?: string): Promise<GoogleAuthResult | null> {
  if (!auth) {
    throw new Error('Google Sign-In is not configured. Missing VITE_FIREBASE_API_KEY environment variable.');
  }
  try {
    const provider = new GoogleAuthProvider();
    if (loginHintEmail && loginHintEmail.trim()) {
      provider.setCustomParameters({
        login_hint: loginHintEmail.trim().toLowerCase(),
        prompt: 'select_account'
      });
    } else {
      provider.setCustomParameters({
        prompt: 'select_account'
      });
    }
    const cred = await signInWithPopup(auth, provider);
    const user = cred.user;
    if (!user.email) {
      throw new Error('Google account did not provide an email address.');
    }
    const idToken = await user.getIdToken();
    return {
      idToken,
      email: user.email,
      fullName: user.displayName || user.email.split('@')[0],
      photoUrl: user.photoURL || undefined
    };
  } catch (err: any) {
    if (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request'
    ) {
      return null; // User cancelled / dismissed the popup
    }
    if (err.code === 'auth/popup-blocked') {
      throw new Error('Google sign-in popup was blocked by your browser. Please allow popups for this site.');
    }
    throw new Error(err.message || 'Google sign-in failed. Please try again.');
  }
}
