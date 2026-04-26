import { useState, useEffect } from 'react';
import { User } from '../types/models';
import { UserService } from '../services/UserService';
import {CrashLogger} from "../services/LoggingService";

interface UseUserProfileResult {
  profile: User | null;
  loading: boolean;
}

/**
 * Hook that fetches the current user's Firestore profile document.
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

    let cancelled = false;

    const fetchProfile = async () => {
      setLoading(true);
      try {
        const userDoc = await UserService.getUserDocument(uid);
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

    return () => {
      cancelled = true;
    };
  }, [uid]);

  return { profile, loading };
};
