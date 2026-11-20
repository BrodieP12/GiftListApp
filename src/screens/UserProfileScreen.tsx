import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import Constants from 'expo-constants';
import { useFeedback } from '../theme/FeedbackContext';
import ProfileImage from '../components/common/ProfileImage';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';

/**
 * UserProfileScreen
 * ---------------------------------------------------------------------------
 * The "Profile" tab: a read-only summary of the signed-in user's identity
 * (avatar, name, email), plus account actions (logout) and a way to submit
 * in-app feedback.
 *
 * Navigation:
 * - Route: `AppStackParamList['UserProfileScreen']`, no params — this is the
 *   sole screen in the Profile tab's stack.
 * - No forward navigation; "Logout" clears the Supabase Auth session via
 *   `useAuth().logout()`, and (as with login) the resulting auth-state
 *   change is what actually swaps the app back to the unauthenticated Auth
 *   stack — this screen never calls `navigation.navigate` itself.
 *
 * Notes:
 * - This screen intentionally does NOT expose edit fields for compliance
 *   data (birthday, minor/parent-email, GDPR/terms acceptance) — those are
 *   captured once at signup (see CreateProfile) and are not editable here.
 * - Feedback submission UI lives in a separate modal opened via
 *   `useFeedback().openFeedback()` (see theme/FeedbackContext +
 *   FeedbackService) rather than being inlined into this screen.
 */
export const UserProfileScreen = () => {
  const { user, logout } = useAuth();
  const { openFeedback } = useFeedback();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const fullName = `${user?.givenName || ''} ${user?.familyName || ''}`.trim() || user?.displayName || 'User';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <ProfileImage
          email={user?.email ?? ''}
          givenName={user?.givenName ?? ''}
          familyName={user?.familyName ?? ''}
          size={100}
        />
        <Text style={styles.userName}>{fullName}</Text>
        <Text style={styles.userEmail}>{user?.email}</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <Button title="Logout" variant="danger" onPress={logout} icon="sign-out-alt" style={styles.button} />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.description}>Have an issue or suggestion? We'd love to hear from you!</Text>
        <Button title="Send Feedback" onPress={openFeedback} icon="comment-dots" style={styles.button} />
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>GiftListApp v{appVersion}</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, alignItems: 'center' },
  header: { alignItems: 'center', marginBottom: 30, marginTop: 20 },
  userName: { fontSize: 24, fontWeight: 'bold', marginTop: 16, color: colors.text },
  userEmail: { fontSize: 16, marginTop: 4, color: colors.textDim },
  section: {
    width: '100%', backgroundColor: colors.card, borderRadius: 16,
    padding: 20, marginBottom: 20, shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3,
  },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: colors.text },
  description: { fontSize: 14, marginBottom: 16, lineHeight: 20, color: colors.textDim },
  button: { width: '100%' },
  footer: { marginTop: 20, marginBottom: 40 },
  version: { fontSize: 12, color: colors.textDim },
});
