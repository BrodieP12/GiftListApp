import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  fetchSignInMethodsForEmail,
  AuthError
} from 'firebase/auth';
import { auth } from '../api/firebase';

export const AuthService = {
  /**
   * Checks if an email is already in use using both Firebase Auth and Firestore.
   * This ensures we catch legacy users (Auth only) and new users (Firestore profiles).
   */
  async isEmailInUse(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();
    
    try {
      // 1. Check Firebase Auth (Works for legacy users if enumeration protection is off)
      const methods = await fetchSignInMethodsForEmail(auth, cleanEmail);
      if (methods.length > 0) return true;

      // 2. Fallback: Check Firestore (Works for new users with profiles)
      // Note: Requires 'allow list: if request.query.limit <= 1' in firestore.rules
      const { collection, query, where, getDocs, limit, getFirestore } = await import('firebase/firestore');
      const db = getFirestore();
      const userRef = collection(db, 'users');
      const q = query(userRef, where('email', '==', cleanEmail), limit(1));
      const snapshot = await getDocs(q);
      
      return !snapshot.empty;
    } catch (error) {
      // Fallback: assume not in use and let the actual registration throw if needed
      return false;
    }
  },
  /**
   * Logs in an existing user.
   */
  async login(email: string, pass: string) {
    try {
      await signInWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      throw this.handleError(error as AuthError);
    }
  },

  /**
   * Registers a new user.
   */
  async register(email: string, pass: string) {
    try {
      await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
      throw this.handleError(error as AuthError);
    }
  },

  /**
   * Logs out the current user.
   */
  async logout() {
    try {
      await signOut(auth);
    } catch (error) {
      // Logout failed
    }
  },

  /**
   * Helper to map Firebase error codes to readable messages.
   */
  handleError(error: AuthError): Error {
    let message = 'An unexpected error occurred.';
    
    switch (error.code) {
      case 'auth/invalid-email':
        message = 'Please enter a valid email address.';
        break;
      case 'auth/user-disabled':
        message = 'This account has been disabled.';
        break;
      case 'auth/user-not-found':
      case 'auth/wrong-password':
      case 'auth/invalid-credential':
        message = 'Invalid email or password.';
        break;
      case 'auth/email-already-in-use':
        message = 'An account with this email already exists.';
        break;
      case 'auth/weak-password':
        message = 'Password should be at least 6 characters.';
        break;
    }

    return new Error(message);
  }
};