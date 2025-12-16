import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FIREBASE_AUTH_DOMAIN,
  projectId: process.env.FIREBASE_PROJECT_ID,
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.FIREBASE_APP_ID
};

// Only initialize if configuration is present to prevent errors in environments without credentials
const app = (firebaseConfig.apiKey && firebaseConfig.projectId) 
  ? initializeApp(firebaseConfig) 
  : null;

export const db = app ? getFirestore(app) : null;
export const auth = app ? getAuth(app) : null;