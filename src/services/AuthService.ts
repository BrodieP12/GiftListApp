import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';

/**
 * Wraps Supabase Auth calls for email/password authentication and maps its
 * raw error strings to user-friendly messages. This is the only module that
 * should talk to `supabase.auth` directly for login/registration — screens
 * call these methods rather than the Supabase client so error copy and
 * email normalization stay consistent everywhere.
 *
 * Business rule: emails are always trimmed and lowercased before being sent
 * to Supabase so that lookups (login, isEmailInUse) are case-insensitive
 * and don't fail due to accidental whitespace.
 */
export const AuthService = {
  /**
   * Signs the user in with email/password.
   * Throws a user-friendly Error (via `mapAuthError`) on failure — callers
   * should catch and display `error.message` directly.
   */
  async login(email: string, password: string): Promise<void> {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
  },

  /**
   * Creates a new Supabase Auth user.
   *
   * Note: this returns the newly created `{ id, email }` directly from the
   * signUp response rather than the caller calling `supabase.auth.getUser()`
   * afterward — immediately after signUp there is no active session yet
   * (until the user confirms email or auto-confirm is enabled), so
   * `getUser()` would fail. Callers (e.g. CreateProfile) must use this
   * return value to create the user's profile row.
   */
  async register(email: string, password: string): Promise<{ id: string; email: string }> {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error) throw new Error(mapAuthError(error.message));
    if (!data.user) throw new Error('Sign up did not return a user.');
    return { id: data.user.id, email: data.user.email ?? email };
  },

  /**
   * Signs the current user out. Failures are logged but never thrown —
   * logout should always succeed from the UI's perspective (worst case the
   * local session is cleared even if the network call fails).
   */
  async logout(): Promise<void> {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      CrashLogger.error(error, 'AuthService.logout');
    }
  },

  /** Sends a password-reset email via Supabase Auth. */
  async sendPasswordReset(email: string): Promise<void> {
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase()
    );
    if (error) throw new Error(error.message);
  },

  /**
   * Checks whether an email is already associated with a profile.
   * Used by registration/onboarding flows to warn the user before they
   * attempt to sign up with an email that's already taken.
   *
   * On lookup failure this fails "open" — it returns `false` (i.e. "not in
   * use") rather than throwing, since this check is advisory only and
   * Supabase Auth itself is the final authority that rejects duplicate
   * sign-ups.
   */
  async isEmailInUse(email: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle();

    if (error) {
      CrashLogger.error(error, 'AuthService.isEmailInUse');
      return false;
    }
    return data !== null;
  },
};

/**
 * Translates raw Supabase Auth error messages into copy suitable for
 * display to end users. Unrecognized messages are passed through as-is so
 * new/unexpected Supabase errors are never silently swallowed.
 */
function mapAuthError(message: string): string {
  if (message.includes('Invalid login credentials')) return 'Invalid email or password.';
  if (message.includes('Email not confirmed')) return 'Please confirm your email before logging in.';
  if (message.includes('User already registered')) return 'An account with this email already exists.';
  if (message.includes('Password should be at least')) return 'Password must be at least 6 characters.';
  if (message.includes('Too many requests')) return 'Too many attempts. Try again later.';
  return message;
}
