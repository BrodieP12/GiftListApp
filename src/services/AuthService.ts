import { FirebaseAuthTypes } from '@react-native-firebase/auth';
import { CrashLogger } from './LoggingService'
import { auth, functions } from '../api/firebase';

export const AuthService = {
  /**
   * Checks if an email is already in use using both Firebase Auth and Firestore.
   * This ensures we catch legacy users (Auth only) and new users (Firestore profiles).
   */
  async isEmailInUse(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const checkEmailFunc = functions.httpsCallable<{ email: string }, { inUse: boolean }>('checkEmailInUse');

      const response = await checkEmailFunc({ email: cleanEmail });
      return response.data.inUse;

    } catch (error) {
      CrashLogger.error(error, 'AuthService.isEmailInUse');
      // On failure, fail safely and let Firebase Auth handle it downstream
      return false;
    }
  },
  /**
   * Logs in an existing user.
   */
  async login(email: string, pass: string) {
    try {
      await auth.signInWithEmailAndPassword(email, pass);
    } catch (error) {
      CrashLogger.error(error);
      throw this.handleError(error as FirebaseAuthTypes.NativeFirebaseAuthError, true);
    }
  },

  /**
   * Registers a new user.
   */
  async register(email: string, pass: string) {
    try {
      await auth.createUserWithEmailAndPassword(email, pass);
    } catch (error) {
      CrashLogger.error(error);
      throw this.handleError(error as FirebaseAuthTypes.NativeFirebaseAuthError, false);
    }
  },

  /**
   * Logs out the current user.
   */
  async logout() {
    try {
      await auth.signOut();
    } catch (error) {
      // Logout failed
      CrashLogger.error(error);
    }
  },
  /**
   * Helper to map Firebase error codes to readable messages.
   */
  handleError(error: FirebaseAuthTypes.NativeFirebaseAuthError, loggingIn: boolean): Error {
    const mappedResponse = AUTH_MESSAGES[error.code];
    let finalMessage = 'An unexpected error occurred.';

    if(typeof mappedResponse === 'string') {
      finalMessage = mappedResponse;
    } else if(typeof mappedResponse === 'object') {
      finalMessage = loggingIn ? mappedResponse.login : mappedResponse.signup;
    }

    return new Error(finalMessage);
  },

};
const AUTH_MESSAGES: Record<string, string | {login: string, signup: string}> = {
  'auth/invalid-email': {
    login: 'Invalid email or password.',
    signup: 'Please enter a valid email address.'
  },
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'Invalid email or password.',
  'auth/wrong-password': 'Invalid email or password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Try again later.',

}