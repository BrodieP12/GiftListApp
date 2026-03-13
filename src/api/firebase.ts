import { Platform } from 'react-native';
import { initializeApp, getApp, getApps, FirebaseApp } from 'firebase/app';
import { 
  getAuth, 
  Auth,
  initializeAuth,
  // @ts-ignore
  getReactNativePersistence 
} from 'firebase/auth'; 
import { getFirestore, Firestore } from 'firebase/firestore';
import { getFunctions, Functions } from 'firebase/functions';
import AsyncStorage from '@react-native-async-storage/async-storage';
// 1. Your Web App Configuration
// TODO: Replace these values with your actual Firebase Project keys.
// Go to Firebase Console -> Project Settings -> General -> Your Apps -> Web App
const firebaseConfig = {
  apiKey: "AIzaSyDWxeuR5lvWg4mSGd17OYWLRNLXbr1y64s",
  authDomain: "giftlistapp-557ce.firebaseapp.com",
  databaseURL: "https://giftlistapp-557ce-default-rtdb.firebaseio.com",
  projectId: "giftlistapp-557ce",
  storageBucket: "giftlistapp-557ce.firebasestorage.app",
  messagingSenderId: "616461662273",
  appId: "1:616461662273:web:b3d70b9bea6bdd005c6ec0",
  measurementId: "G-C12CCXGTDW"
};

let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let functions: Functions;

// 2. Initialize Firebase
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
  
  // ROBUST AUTH INITIALIZATION
  // We use a try-catch pattern to handle different Firebase versions gracefully
  try {
    if (Platform.OS === 'web') {
      auth = getAuth(app);
    } else {
      // Try explicit React Native persistence (Standard for Firebase v10+)
      auth = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage)
      });
    }
  } catch (e) {
    console.warn("Explicit persistence failed, falling back to default getAuth.");
    // Fallback: This auto-detects the environment
    auth = getAuth(app);
  }

} else {
  app = getApp();
  auth = getAuth(app);
}

// 3. Initialize Services
db = getFirestore(app);
functions = getFunctions(app);

export { app, auth, db, functions };