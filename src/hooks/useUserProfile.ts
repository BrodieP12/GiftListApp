import { useState, useEffect } from 'react';
import { User } from '../types/models';
import { UserService } from '../services/UserService';
import {CrashLogger} from "../services/LoggingService";

interface UseUserProfileResult {
  profile: User | null;
  loading: boolean;
}

/**
 * Fetches a user's profile (`profiles` table row) by id.
 *
 * Unlike most other hooks in this codebase, this one is a plain one-shot
 * fetch (`UserService.getUserProfile`) rather than a Supabase Realtime
 * subscription - profile data here isn't expected to change live while
 * being viewed (e.g. viewing a friend's profile), so there's no
 * `postgres_changes` channel to manage or unsubscribe.
 *
 * State managed: `profile` (`User | null`) and `loading`.
 *
 * @param uid - id of the profile to load (e.g. the signed-in user's uid,
 * or another user's uid when viewing their profile). While `null`, the
 * hook stays idle with `profile: null`.
 * @returns `{ profile, loading }`.
 *
 * Lifecycle: re-fetches whenever `uid` changes (including on mount).
 *
 * Usage: const { profile, loading } = useUserProfile(uid);
 */
export const useUserProfile = (uid: string | null): UseUserProfileResult => {
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!uid) {
      setProfile(null);
      setLoading(false);
      return;
    }

    // Race-condition guard: if `uid` changes again (or the component
    // unmounts) before this fetch resolves - e.g. the user rapidly
    // navigates between two profiles - `cancelled` prevents the stale,
    // in-flight response from a *previous* uid overwriting state that
    // now belongs to a newer uid/unmounted component.
    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const userDoc = await UserService.getUserProfile(uid);
        if (!cancelled) {
          setProfile(userDoc);
        }
      } catch (error) {
        CrashLogger.error(error);
        // Failed to fetch user profile
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchProfile();

    // Cleanup: mark this effect's fetch as cancelled on unmount or before
    // the effect re-runs for a new `uid`, so its `.then`/`finally`
    // handlers become no-ops if they resolve after the fact.
    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { profile, loading };
};
