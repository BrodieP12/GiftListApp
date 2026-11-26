import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../api/supabase';
import { User, UserProfile } from '../types/models';
import { NotificationPreferences } from '../types/notifications';
import { mergeNotificationPreferences } from '../constants/notifications';

/**
 * UserService
 * -----------
 * Manages user *profile* data stored in `public.profiles` (display name,
 * avatar, birthday, premium status, minor-protection and legal-acceptance
 * flags) as distinct from authentication, which is handled by
 * AuthService/Supabase Auth. A `profiles` row is auto-created with just
 * `id`/`email` by a DB trigger (`handle_new_user`) whenever a new
 * `auth.users` row is inserted; `createUserProfile` is used to fill in the
 * rest (and to update it later).
 *
 * RLS on `profiles`: any authenticated user can SELECT any profile (needed
 * for friend search, showing names/avatars on shared lists, etc.), but a
 * user can only INSERT/UPDATE their own row (`auth.uid() = id`).
 */

/**
 * Builds a blank `User` object with sensible defaults for a brand-new account, before the
 * user has filled in any profile details.
 *
 * @param uid - The new user's auth uid, used as `User.uid`.
 * @param email - The new user's email, used as `User.email`.
 * @returns A `User` with every optional field empty/false/null — name fields as `''`,
 *   `photoURL`/`birthday`/`createdAt` as `null`, `isPremium: false`, and both
 *   `minorProtection` and `legalAcceptance` sub-objects defaulted to "not a minor" /
 *   "nothing accepted yet". This is a purely local object; it does not write anything to the
 *   database — pass it to `createUserProfile` to persist it.
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
   * Creates or fully overwrites a user's profile row.
   *
   * @param user - The complete `User` object to persist; every camelCase field is mapped to
   *   its snake_case column (`displayName` -> `display_name`, `minorProtection.isMinor` ->
   *   `is_minor`, etc.). Nested optional objects (`minorProtection`, `legalAcceptance`) are
   *   read defensively with `?? false`/`?? null` fallbacks so a partially-populated `User`
   *   still produces valid non-undefined column values.
   *
   * Uses `.upsert()` keyed on `id` (the primary key, matching `auth.users.id`), so this is
   * safe to call both for the very first save (filling in the row the `handle_new_user`
   * trigger already created with just an id/email) and for subsequent profile edits.
   *
   * @throws {PostgrestError} If the upsert is rejected by RLS (not the profile owner) or on
   *   any other DB error.
   */
  async createUserProfile(user: User): Promise<void> {
    const payload: Record<string, any> = {
      id: user.uid,
      email: user.email,
      display_name: user.displayName,
      given_name: user.givenName,
      family_name: user.familyName,
      photo_url: user.photoURL,
      birthday: user.birthday,
      is_premium: user.isPremium,
      is_minor: user.minorProtection?.isMinor ?? false,
      parent_email: user.minorProtection?.parentEmail ?? null,
      terms_accepted: user.legalAcceptance?.termsAccepted ?? false,
      privacy_accepted: user.legalAcceptance?.privacyAccepted ?? false,
      acceptance_date: user.legalAcceptance?.acceptanceDate ?? null,
      is_eu_user: user.legalAcceptance?.isEUUser ?? false,
      gdpr_applies: user.legalAcceptance?.gdprApplies ?? false,
      accepted_data_processing: user.legalAcceptance?.acceptedDataProcessing ?? false,
      preferred_retailers: user.preferredRetailers ?? null,
      notification_preferences: user.notificationPreferences ?? null,
    };

    const { error } = await supabase.from('profiles').upsert(payload);
    if (error) {
      if (
        error.code === '42703' ||
        error.message?.includes('preferred_retailers') ||
        error.message?.includes('notification_preferences')
      ) {
        if (error.message?.includes('preferred_retailers') || error.code === '42703') {
          delete payload.preferred_retailers;
        }
        if (error.message?.includes('notification_preferences') || error.code === '42703') {
          delete payload.notification_preferences;
        }
        const retry = await supabase.from('profiles').upsert(payload);
        if (retry.error) throw retry.error;
        return;
      }
      throw error;
    }
  },

  /**
   * Fetches a user's full profile (including private fields like legal-acceptance and
   * minor-protection flags — appropriate for loading your own profile, not someone else's).
   *
   * @param uid - The profile id (= auth uid) to fetch.
   * @returns The full `User`, or `null` if no profile row exists for that id.
   * @throws {PostgrestError} On any DB error other than "not found".
   */
  async getUserProfile(uid: string): Promise<User | null> {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) throw error;
    if (!data) return null;
    const user = mapRowToUser(data);

    // If preferredRetailers is not present on the DB profile, check local storage fallback
    if (!user.preferredRetailers || user.preferredRetailers.length === 0) {
      try {
        const cached =
          (await AsyncStorage.getItem(`@giftlist_preferred_retailers_${uid}`)) ||
          (await AsyncStorage.getItem('@giftlist_preferred_retailers'));
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed) && parsed.length > 0) {
            user.preferredRetailers = parsed;
          }
        }
      } catch {
        // non-blocking
      }
    }

    // If notificationPreferences is not present on the DB profile, check local storage fallback
    if (!user.notificationPreferences) {
      try {
        const cachedPrefs = await AsyncStorage.getItem(`@giftlist_notification_preferences_${uid}`);
        if (cachedPrefs) {
          user.notificationPreferences = mergeNotificationPreferences(JSON.parse(cachedPrefs));
        }
      } catch {
        // non-blocking
      }
    }

    return user;
  },

  /**
   * Searches for users by partial email match, for the "add friend" flow.
   *
   * @param query - Partial or full email text to search for; matched with
   *   `.ilike('email', '%query%')` (case-insensitive substring match).
   *
   * Only selects the public-safe columns (`id, email, display_name, given_name, family_name,
   * photo_url`) — deliberately excludes sensitive fields like `birthday`, premium status, and
   * legal-acceptance/minor-protection data, since this result set may be shown to other users
   * searching for friends. Capped at 10 results to avoid an unbounded/expensive fetch on a
   * broad query.
   *
   * @returns Up to 10 matching `UserProfile`s.
   * @throws {PostgrestError} On any DB error.
   */
  async searchUsersByEmail(query: string): Promise<UserProfile[]> {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, given_name, family_name, photo_url')
      .ilike('email', `%${query}%`)
      .limit(10);

    if (error) throw error;
    return (data ?? []).map(mapRowToProfile);
  },

  /**
   * Batch-fetches public profiles for a set of user ids (e.g. to render a list of friends or
   * conversation participants in one call instead of one query per user).
   *
   * @param uids - The user ids to fetch. Same public-safe column selection as
   *   `searchUsersByEmail`.
   * @returns `UserProfile`s for whichever of the given ids exist (silently omits any that
   *   don't, or that RLS hides — though profiles are readable by anyone). Returns `[]`
   *   immediately without a network call if `uids` is empty.
   * @throws {PostgrestError} On any DB error.
   */
  async getUserProfiles(uids: string[]): Promise<UserProfile[]> {
    if (!uids.length) return [];
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, given_name, family_name, photo_url')
      .in('id', uids);

    if (error) throw error;
    return (data ?? []).map(mapRowToProfile);
  },

  /**
   * Updates the preferred retailers list for a user account in Supabase.
   *
   * @param uid - The profile id (= auth uid) to update.
   * @param retailers - Array of retailer domain strings, e.g. ['amazon.com', 'target.com'].
   */
  async updatePreferredRetailers(uid: string, retailers: string[]): Promise<void> {
    // 1. Always cache locally in AsyncStorage so user choices are never lost
    try {
      await AsyncStorage.setItem(`@giftlist_preferred_retailers_${uid}`, JSON.stringify(retailers));
      await AsyncStorage.setItem('@giftlist_preferred_retailers', JSON.stringify(retailers));
    } catch {
      // non-blocking
    }

    // 2. Persist to Supabase public.profiles
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ preferred_retailers: retailers })
        .eq('id', uid);

      if (error) {
        // If preferred_retailers column does not exist on profiles yet (42703), safely fallback to local cache
        if (error.code === '42703' || error.message?.includes('preferred_retailers')) {
          console.warn('[UserService.updatePreferredRetailers] Column preferred_retailers missing on profiles table; cached in local storage.');
          return;
        }
        throw error;
      }
    } catch (err: any) {
      if (err?.code === '42703' || err?.message?.includes('preferred_retailers')) {
        console.warn('[UserService.updatePreferredRetailers] Column preferred_retailers missing; cached in local storage.');
        return;
      }
      throw err;
    }
  },

  /**
   * Updates the user's notification preferences in AsyncStorage and Supabase `public.profiles`.
   */
  async updateNotificationPreferences(uid: string, preferences: NotificationPreferences): Promise<void> {
    const normalized = mergeNotificationPreferences(preferences);
    try {
      await AsyncStorage.setItem(`@giftlist_notification_preferences_${uid}`, JSON.stringify(normalized));
    } catch {
      // non-blocking
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ notification_preferences: normalized })
        .eq('id', uid);

      if (error) {
        if (error.code === '42703' || error.message?.includes('notification_preferences')) {
          console.warn('[UserService.updateNotificationPreferences] Column notification_preferences missing; cached locally.');
          return;
        }
        throw error;
      }
    } catch (err: any) {
      if (err?.code === '42703' || err?.message?.includes('notification_preferences')) {
        console.warn('[UserService.updateNotificationPreferences] Column notification_preferences missing; cached locally.');
        return;
      }
      throw err;
    }
  },
};

/** Maps a raw `profiles` table row (snake_case) to the full camelCase `User` model, including private fields (legal acceptance, minor protection). Used for loading the current user's own profile. */
function mapRowToUser(row: any): User {
  return {
    uid: row.id,
    email: row.email ?? '',
    displayName: row.display_name ?? '',
    givenName: row.given_name ?? '',
    familyName: row.family_name ?? '',
    photoURL: row.photo_url ?? null,
    birthday: row.birthday ?? null,
    isPremium: row.is_premium ?? false,
    preferredRetailers: Array.isArray(row.preferred_retailers) ? row.preferred_retailers : undefined,
    notificationPreferences: row.notification_preferences
      ? mergeNotificationPreferences(row.notification_preferences)
      : undefined,
    createdAt: row.created_at ?? null,
    minorProtection: {
      isMinor: row.is_minor ?? false,
      parentEmail: row.parent_email ?? '',
    },
    legalAcceptance: {
      termsAccepted: row.terms_accepted ?? false,
      privacyAccepted: row.privacy_accepted ?? false,
      acceptanceDate: row.acceptance_date ?? null,
      isEUUser: row.is_eu_user ?? false,
      gdprApplies: row.gdpr_applies ?? false,
      acceptedDataProcessing: row.accepted_data_processing ?? false,
    },
  };
}

/** Maps a raw `profiles` row to the reduced public-safe `UserProfile` shape (no private/legal fields) — used anywhere another user's profile is shown, e.g. friends, message participants. */
function mapRowToProfile(row: any): UserProfile {
  return {
    id: row.id,
    email: row.email ?? '',
    displayName: row.display_name ?? '',
    givenName: row.given_name ?? '',
    familyName: row.family_name ?? '',
    photoURL: row.photo_url ?? null,
    preferredRetailers: Array.isArray(row.preferred_retailers) ? row.preferred_retailers : undefined,
  };
}
