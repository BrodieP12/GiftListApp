import { CrashLogger } from './LoggingService';
import { supabase } from '../api/supabase';

export const AuthService = {
  /**
   * Checks if an email is already registered.
   * Delegates to the `check-email` Edge Function, which uses the service role
   * to look across Supabase Auth + the profiles table (bypassing RLS).
   */
  async isEmailInUse(email: string): Promise<boolean> {
    const cleanEmail = email.trim().toLowerCase();

    try {
      const { data, error } = await supabase.functions.invoke<{ inUse: boolean }>(
        'check-email',
        { body: { email: cleanEmail } }
      );
      if (error) throw error;
      return data?.inUse ?? false;
    } catch (error) {
      CrashLogger.error(error, 'AuthService.isEmailInUse');
      // Fail safe: let sign-up proceed and surface a duplicate at that stage.
      return false;
    }
  },

  /**
   * Logs in an existing user.
   */
  async login(email: string, pass: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      CrashLogger.error(error);
      throw this.handleError(error, true);
    }
  },

  /**
   * Registers a new user. A profiles row is created automatically by the
   * `handle_new_user` database trigger.
   */
  async register(email: string, pass: string) {
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password: pass,
    });
    if (error) {
      CrashLogger.error(error);
      throw this.handleError(error, false);
    }
  },

  /**
   * Logs out the current user.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      CrashLogger.error(error);
    }
  },

  /**
   * Step 1 of password reset: emails the user a 6-digit recovery code.
   * (The Supabase "Reset Password" email template must expose {{ .Token }};
   * see SETUP_AND_RELEASE.md / PLAYSTORE_RELEASE.md.)
   */
  async sendPasswordReset(email: string) {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    if (error) {
      CrashLogger.error(error, 'AuthService.sendPasswordReset');
      throw this.handleError(error, true);
    }
  },

  /**
   * Step 2 of password reset: verifies the emailed code, sets the new password,
   * then signs out so the user logs in fresh with their new credentials.
   */
  async confirmPasswordReset(email: string, code: string, newPassword: string) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verifyError) {
      CrashLogger.error(verifyError, 'AuthService.confirmPasswordReset.verify');
      throw new Error('That code is invalid or has expired. Please request a new one.');
    }

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) {
      CrashLogger.error(updateError, 'AuthService.confirmPasswordReset.update');
      throw this.handleError(updateError, false);
    }

    // Return to a clean, signed-out state so the user logs in with the new password.
    await supabase.auth.signOut();
  },

  /**
   * Maps Supabase/GoTrue auth errors to readable, user-facing messages.
   * GoTrue returns a message string (and sometimes a `code`/`status`), unlike
   * Firebase's `auth/*` codes, so we match on both.
   */
  handleError(error: any, loggingIn: boolean): Error {
    const code: string = error?.code ?? '';
    const msg: string = (error?.message ?? '').toLowerCase();
    const status: number = error?.status ?? 0;

    let key: keyof typeof AUTH_MESSAGES | null = null;

    if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) {
      key = 'invalid-credentials';
    } else if (code === 'user_already_exists' || msg.includes('already registered')) {
      key = 'email-already-in-use';
    } else if (code === 'weak_password' || msg.includes('password should be')) {
      key = 'weak-password';
    } else if (msg.includes('email') && msg.includes('invalid')) {
      key = 'invalid-email';
    } else if (status === 429 || msg.includes('rate limit') || msg.includes('too many')) {
      key = 'too-many-requests';
    }

    let finalMessage = 'An unexpected error occurred.';
    if (key) {
      const mapped = AUTH_MESSAGES[key];
      finalMessage =
        typeof mapped === 'string' ? mapped : loggingIn ? mapped.login : mapped.signup;
    }
    return new Error(finalMessage);
  },
};

const AUTH_MESSAGES: Record<string, string | { login: string; signup: string }> = {
  'invalid-email': {
    login: 'Invalid email or password.',
    signup: 'Please enter a valid email address.',
  },
  'invalid-credentials': 'Invalid email or password.',
  'email-already-in-use': 'An account with this email already exists.',
  'weak-password': 'Password should be at least 6 characters.',
  'too-many-requests': 'Too many attempts. Try again later.',
};
