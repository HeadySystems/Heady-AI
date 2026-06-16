import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "firebase/auth";

const firebaseConfig = {
  projectId: "heady-ai",
  appId: "1:1003436179562:web:1ab30825a7119a82578a13",
  storageBucket: "heady-ai.firebasestorage.app",
  apiKey: "AIzaSyBpPClFwr0VDxl_D1SLe2dtvq2MX05QL6g",
  authDomain: "heady-ai.firebaseapp.com",
  messagingSenderId: "1003436179562",
  measurementId: "G-M1M5SZ6WFY"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

export { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut };
