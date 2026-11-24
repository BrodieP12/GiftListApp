import React, { useState, useLayoutEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import Constants from 'expo-constants';
import { useFeedback } from '../theme/FeedbackContext';
import { useAppUpdate } from '../hooks/useAppUpdate';
import { UpdateModal } from '../components/common/UpdateModal';
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
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const { openFeedback } = useFeedback();
  const { isChecking, updateInfo, checkForUpdates, openUpdate } = useAppUpdate();
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  // Top-right gear icon in the header for account & store settings
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <TouchableOpacity
          onPress={() => navigation.navigate('AccountSettings')}
          style={{ marginRight: 16, padding: 6 }}
          accessibilityLabel="Account and Store Settings"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <FontAwesome5 name="cog" size={20} color={colors.text} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, colors]);

  const fullName = `${user?.givenName || ''} ${user?.familyName || ''}`.trim() || user?.displayName || 'User';
  const appVersion = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      overScrollMode="always"
      bounces={true}
    >
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
        <Text style={styles.sectionTitle}>Preferences</Text>
        <Text style={styles.description}>Customize which stores and links the product extractor prioritizes.</Text>
        <Button
          title="Store Preferences"
          variant="secondary"
          onPress={() => navigation.navigate('AccountSettings')}
          icon="sliders-h"
          style={styles.button}
        />
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

        {isChecking ? (
          <View style={styles.updateStatusRow}>
            <ActivityIndicator size="small" color={colors.textDim} style={styles.spinner} />
            <Text style={styles.updateStatusText}>Checking for updates...</Text>
          </View>
        ) : updateInfo?.isAvailable ? (
          <TouchableOpacity
            style={styles.updateAvailableBadge}
            onPress={() => setUpdateModalVisible(true)}
            activeOpacity={0.8}
          >
            <FontAwesome5 name="arrow-circle-up" size={13} color={colors.primary} />
            <Text style={styles.updateAvailableText}>
              Update available (v{updateInfo.latestVersion}) • Tap to view
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.updateStatusRow}
            onPress={checkForUpdates}
            activeOpacity={0.7}
          >
            <FontAwesome5 name="check-circle" size={12} color={colors.textDim} />
            <Text style={styles.updateStatusText}>Up to date • Tap to check</Text>
          </TouchableOpacity>
        )}
      </View>

      <UpdateModal
        visible={updateModalVisible}
        updateInfo={updateInfo}
        onClose={() => setUpdateModalVisible(false)}
        onUpdate={() => {
          setUpdateModalVisible(false);
          openUpdate();
        }}
      />
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1, padding: 20, paddingBottom: 60, alignItems: 'center' },
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
  footer: { marginTop: 20, marginBottom: 40, alignItems: 'center' },
  version: { fontSize: 13, fontWeight: '500', color: colors.text, marginBottom: 6 },
  updateStatusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    gap: 6,
  },
  spinner: {
    marginRight: 2,
    transform: [{ scale: 0.75 }],
  },
  updateStatusText: {
    fontSize: 12,
    color: colors.textDim,
  },
  updateAvailableBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary + '18',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.primary + '33',
    gap: 6,
    marginTop: 2,
  },
  updateAvailableText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
});
