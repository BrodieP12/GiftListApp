import { Platform } from 'react-native';
import { supabase } from '../api/supabase';
import { CrashLogger } from './LoggingService';

export const FeedbackService = {
  /**
   * Submits user feedback. The feedback table is insert-only for clients (RLS);
   * a database webhook forwards new rows to Google Sheets via Edge Function.
   */
  async submitFeedback(
    userId: string,
    userEmail: string,
    text: string,
    type: string = 'general',
    isAnonymous: boolean = false
  ) {
    if (!text.trim()) throw new Error('Feedback cannot be empty');

    const { error } = await supabase.from('feedback').insert({
      user_id: isAnonymous ? 'anonymous' : userId,
      user_email: isAnonymous ? 'anonymous@example.com' : userEmail,
      text,
      type,
      is_anonymous: isAnonymous,
      platform:
        Platform.OS === 'ios' ? 'iOS' : Platform.OS === 'android' ? 'Android' : 'Web',
    });
    if (error) {
      CrashLogger.error(error, 'FeedbackService.submitFeedback');
      throw error;
    }
  },
};
