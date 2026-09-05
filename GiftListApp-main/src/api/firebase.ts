import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';
import functions from '@react-native-firebase/functions';

const db = firestore();
const firebaseAuth = auth();
const firebaseFunctions = functions();

export { firebaseAuth as auth, db, firebaseFunctions as functions };

// let app: FirebaseApp;
// let auth: Auth;
// let db: Firestore;
// let functions: Functions;
//
// // 2. Initialize Firebase
// if (!getApps().length) {
//   app = initializeApp(firebaseConfig);
//
//   // ROBUST AUTH INITIALIZATION
//   // We use a try-catch pattern to handle different Firebase versions gracefully
//   try {
//     if (Platform.OS === 'web') {
//       auth = getAuth(app);
//     } else {
//       // Try explicit React Native persistence (Standard for Firebase v10+)
//       auth = initializeAuth(app, {
//         persistence: getReactNativePersistence(AsyncStorage)
//       });
//     }
//   } catch (e) {
//     // Fallback: This auto-detects the environment
//     auth = getAuth(app);
//   }
//
//   // ROBUST FIRESTORE INITIALIZATION (Offline Support)
//   try {
//     db = initializeFirestore(app, {
//       localCache: persistentLocalCache()
//     });
//   } catch (e) {
//     db = getFirestore(app);
//   }
//
// } else {
//   app = getApp();
//   auth = getAuth(app);
//   db = getFirestore(app);
// }
//
// // 3. Initialize Services
// functions = getFunctions(app);
//
// export { app, auth, db, functions };