// src/services/AuthService.ts
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  signOut,
  AuthError
} from 'firebase/auth';
import { auth } from '../api/firebase';

export const AuthService = {
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
      console.error(error);
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