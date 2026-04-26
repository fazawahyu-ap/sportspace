import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// TODO: Ganti dengan config dari Firebase Console kamu
const firebaseConfig = {
  apiKey: "AIzaSyAHda-Xh3tMmw3n0403Qaq7bFYrOuI18Kc",
  authDomain: "sportspace-app-c90a4.firebaseapp.com",
  projectId: "sportspace-app-c90a4",
  storageBucket: "sportspace-app-c90a4.firebasestorage.app",
  messagingSenderId: "440058077038",
  appId: "1:440058077038:web:ddf5a3fcf5e8d34d912b7f",
  measurementId: "G-QSN8HBNH16"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Firestore (Database)
export const db = getFirestore(app);
export const auth = getAuth(app);