import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { User } from '../types/models';
import { UserService, createDefaultUser } from '../services/UserService';
import { CrashLogger } from '../services/LoggingService';

/**
 * Auth state/context module.
 *
 * Responsibilities:
 * - Owns the app-wide authentication state: the raw Supabase `Session`
 *   (JWT/refresh token pair from Supabase Auth) and the app-level `User`
 *   profile row (from the Postgres `profiles` table, fetched via
 *   `UserService`). These are kept as two separate pieces of state because
 *   a session can exist for an instant before the corresponding profile
 *   row has been fetched (or created).
 * - Subscribes to `supabase.auth.onAuthStateChange`, which fires for
 *   sign-in, sign-out, token refresh, and (on native/web) session
 *   restoration on app start. This is the single source of truth for
 *   "is the user logged in" for the rest of the app.
 * - Business rule: if a session exists but no `profiles` row does yet
 *   (e.g. a brand-new sign-up, or a user created directly in Supabase
 *   Auth without ever completing profile creation), a default profile is
 *   auto-provisioned via `createDefaultUser` + `UserService.createUserProfile`.
 *   This guarantees screens that read `user` never have to special-case
 *   "authenticated but no profile".
 * - Exposes `logout`, which only calls `supabase.auth.signOut()`; clearing
 *   local `user`/`session` state happens as a side effect of the
 *   `onAuthStateChange` listener firing afterwards (see below), not
 *   directly inside `logout`.
 */

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  logout: async () => {},
});

/**
 * Provides authentication state to the component tree.
 *
 * Should be mounted once, near the root of the app (see App.tsx), so every
 * screen can read auth state via `useAuth()` below.
 *
 * @param children - subtree that gets access to the auth context.
 *
 * Lifecycle:
 * - On mount, does two things in parallel: (1) reads whatever session is
 *   currently persisted (`supabase.auth.getSession()`) so the app doesn't
 *   flash a logged-out state while Supabase restores a saved session, and
 *   (2) subscribes to `onAuthStateChange` for all future auth events.
 * - Every time a session appears (initial load or a later auth event),
 *   `loadProfile` is triggered to fetch/create the matching profile row.
 * - On unmount, the auth listener subscription is torn down to avoid
 *   calling `setState` on an unmounted provider and to avoid leaking a
 *   duplicate listener if the provider were ever remounted.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadProfile(session.user.id, session.user.email ?? '');
      else setLoading(false);
    });

    // Listen for auth changes. This single listener covers sign-in,
    // sign-out, and silent token refresh, so `user`/`session` stay in
    // sync with Supabase Auth without any screen having to poll or
    // manually re-check auth state.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        loadProfile(session.user.id, session.user.email ?? '');
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Cleanup: unsubscribe the auth listener on unmount so we don't leak
    // it (and don't set state on an unmounted provider) if the provider
    // is ever torn down and re-created.
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Fetches the app-level profile row for a just-authenticated Supabase
   * user, auto-provisioning a default one if this is the user's first
   * time being seen (sign-up, or a session that predates profile
   * creation). Called from both the initial session check and every
   * subsequent auth-state-change event, so it's factored out rather than
   * duplicated inline.
   */
  const loadProfile = async (uid: string, email: string) => {
    setLoading(true);
    try {
      let profile = await UserService.getUserProfile(uid);
      if (!profile) {
        profile = createDefaultUser(uid, email);
        await UserService.createUserProfile(profile);
      }
      setUser(profile);
    } catch (error) {
      CrashLogger.error(error, 'AuthProvider.loadProfile');
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Signs out of Supabase Auth. Intentionally does not clear `user`/
  // `session` itself — the `onAuthStateChange` listener above receives
  // the resulting sign-out event and clears local state there, so there
  // is a single code path that reacts to "no session" regardless of
  // whether it was triggered by this call or by an external event (e.g.
  // token invalidated, signed out in another tab).
  const logout = async () => {
    await supabase.auth.signOut();
  };

  return React.createElement(
    AuthContext.Provider,
    { value: { user, session, loading, logout } },
    children
  );
};

/**
 * Consumer hook for auth state. Returns `{ user, session, loading, logout }`
 * from the nearest `AuthProvider`.
 *
 * @returns
 * - `user` - the app-level profile (`profiles` row), or `null` if not
 *   loaded/authenticated yet.
 * - `session` - the raw Supabase session, or `null` if signed out.
 * - `loading` - true while the initial session/profile lookup (or a
 *   post-auth-event profile reload) is in flight.
 * - `logout` - signs the user out (see `AuthProvider.logout` above).
 *
 * Note: `AuthContext` is created with a non-null default value (all
 * fields defaulted, `loading: true`), so the `!context` guard below can
 * never actually be true in practice — `useContext` only returns
 * `undefined` for a context created without a default. It's left in as a
 * defensive/documentation-style check for "used outside a provider".
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
