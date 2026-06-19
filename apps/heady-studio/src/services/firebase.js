// ╔══════════════════════════════════════════════════════════════════╗
// ║  HEADY™ Studio — Firebase auth service                            ║
// ║  Cross-domain SSO via Firebase Auth (AGENTS.md auth layer).        ║
// ║  © 2026 HeadySystems Inc. — Eric Haywood, Founder                  ║
// ╚══════════════════════════════════════════════════════════════════╝
import { initializeApp } from 'firebase/app';
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup,
} from 'firebase/auth';

const env = import.meta.env;
// Firebase web config is public by design; values come from env, with the
// known heady-ai project as the default so the SPA is usable out of the box.
const firebaseConfig = {
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? 'heady-ai',
  apiKey: env.VITE_FIREBASE_API_KEY ?? 'AIzaSyBpPClFwr0VDxl_D1SLe2dtvq2MX05QL6g',
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? 'heady-ai.firebaseapp.com',
  appId: env.VITE_FIREBASE_APP_ID ?? '1:1003436179562:web:1ab30825a7119a82578a13',
  storageBucket: 'heady-ai.firebasestorage.app',
  messagingSenderId: '1003436179562',
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

/** Fresh Firebase ID token for the current user — the bearer the gateway verifies. */
export async function idToken() {
  const u = auth.currentUser;
  if (!u) throw new Error('not authenticated');
  return u.getIdToken();
}

export { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInWithPopup };
