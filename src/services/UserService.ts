import { supabase } from '../api/supabase';
import { User } from '../types/models';
import { profileFromRow, profileToRow } from '../api/mappers';
import { CrashLogger } from './LoggingService';

/**
 * Creates a default User object with sensible defaults.
 * Used during registration to build a new user profile.
 */
export function createDefaultUser(uid: string, email: string): User {
  return {
    uid,
    email,
    displayName: '',
    givenName: '',
    familyName: '',
    photoURL: null,
    birthday: null,
    isPremium: false,
    createdAt: null,
    minorProtection: {
      isMinor: false,
      parentEmail: '',
    },
    legalAcceptance: {
      termsAccepted: false,
      privacyAccepted: false,
      acceptanceDate: null,
      isEUUser: false,
      gdprApplies: false,
      acceptedDataProcessing: false,
    },
  };
}

export const UserService = {
  /**
   * Creates or updates the caller's profile row.
   * The base row is created by the handle_new_user trigger at signup, so this
   * is effectively an upsert of the editable profile fields.
   */
  async createUserDocument(user: User): Promise<void> {
    const { error } = await supabase
      .from('profiles')
      // email is NOT NULL in the schema, so set it explicitly (last) to keep
      // it a definite string for the insert type.
      .upsert({ ...profileToRow(user), id: user.uid, email: user.email });
    if (error) {
      CrashLogger.error(error, 'UserService.createUserDocument');
      throw error;
    }
  },

  /**
   * Fetches multiple profiles by UID in a single query.
   */
  async getUserDocuments(uids: string[]): Promise<User[]> {
    if (!uids || uids.length === 0) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .in('id', uids);
    if (error) {
      CrashLogger.error(error, 'UserService.getUserDocuments');
      throw error;
    }
    return (data ?? []).map(profileFromRow);
  },

  /**
   * Fetches a single profile by UID. Returns null if none exists.
   */
  async getUserDocument(uid: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    if (error) {
      CrashLogger.error(error, 'UserService.getUserDocument');
      throw error;
    }
    return data ? profileFromRow(data) : null;
  },
};
