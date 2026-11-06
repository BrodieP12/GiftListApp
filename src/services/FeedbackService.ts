import { Platform } from 'react-native';
import { supabase } from '../api/supabase';

/**
 * FeedbackService
 * ---------------
 * Writes user-submitted feedback (bug reports, feature requests, general
 * comments) to the `feedback` table. The table's RLS policy allows anyone
 * to insert ("Anyone can insert feedback" WITH CHECK (true)), including
 * unauthenticated/anonymous submissions, since feedback has no owner-only
 * read requirement in this app — it's a one-way write channel to the devs.
 */
export const FeedbackService = {
  /**
   * Submits a piece of feedback.
   *
   * @param userId - Submitter's auth uid. Ignored (sent as `null`) when `isAnonymous` is true,
   *   so the row can't be traced back to the user.
   * @param userEmail - Submitter's email, for the dev team to follow up. Also nulled out when
   *   `isAnonymous` is true.
   * @param text - The feedback body. Trimmed before both validation and storage.
   * @param type - Free-form category tag (defaults to `'general'`); used by the app to label
   *   submissions as e.g. bug reports vs. feature requests.
   * @param isAnonymous - When true, strips `userId`/`userEmail` from the stored row so the
   *   submission genuinely cannot be attributed to the user, even though they were
   *   authenticated when they sent it.
   *
   * Also stamps the row with `Platform.OS` (`'ios' | 'android' | 'web'`) so the dev team can
   * see which platform a bug report came from.
   *
   * @throws {Error} `'Feedback cannot be empty'` if `text` is empty or whitespace-only.
   * @throws {PostgrestError} If the insert fails for any other reason.
   */
  async submitFeedback(
    userId: string,
    userEmail: string,
    text: string,
    type = 'general',
    isAnonymous = false
  ): Promise<void> {
    if (!text.trim()) throw new Error('Feedback cannot be empty');

    const { error } = await supabase.from('feedback').insert({
      user_id: isAnonymous ? null : userId,
      user_email: isAnonymous ? null : userEmail,
      text: text.trim(),
      type,
      is_anonymous: isAnonymous,
      platform: Platform.OS,
    });

    if (error) throw error;
  },
};
