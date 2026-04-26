import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ToastAndroid } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/common/Button';
import remoteConfig from '@react-native-firebase/remote-config';

import Constants from 'expo-constants';

import { useFeedback } from '../theme/FeedbackContext';
import ProfileImage from '../components/common/ProfileImage';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';


export const UserProfileScreen = () => {
  const [displayVersion, setDisplayVersion] = useState('1.0.0');
  const [ logging, setLogging ] = useState(false);
  const { user, logout } = useAuth();
  const { openFeedback } = useFeedback();


  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  useEffect(() => {
    const fetchRemoteConfig = async () => {
      try {
        // Set default values so the app has something to show immediately
        await remoteConfig().setDefaults({
          current_app_version: '1.0.0',
        });

        // Use 0 for 'every time' checks during testing (default is 12 hours)
        await remoteConfig().fetch(43200);
        await remoteConfig().activate();

        const version = remoteConfig().getValue('current_app_version').asString();
        setDisplayVersion(version);
      } catch (error) {
        console.error("Firebase Remote Config failed: ", error);
      }
    };

    fetchRemoteConfig();
  }, []);



  const fullName = `${user?.givenName || ''} ${user?.familyName || ''}`.trim() || user?.displayName || 'User';

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
        <Button 
          title="Logout" 
          variant="danger" 
          onPress={logout} 
          icon="sign-out-alt"
          style={styles.button}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Text style={styles.description}>
          Have an issue or a suggestion? We'd love to hear from you!
        </Text>
        <Button 
          title="Send Feedback" 
          onPress={openFeedback} 
          icon="comment-dots"
          style={styles.button}
        />
      </View>

      <View style={styles.footer}>
        <Text style={styles.version}>GiftListApp v{displayVersion}</Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 30,
    marginTop: 20,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 16,
    color: colors.text,
  },
  userEmail: {
    fontSize: 16,
    marginTop: 4,
    color: colors.textDim,
  },
  section: {
    width: '100%',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: colors.text,
  },
  description: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
    color: colors.textDim,
  },
  button: {
    width: '100%',
  },
  footer: {
    marginTop: 20,
    marginBottom: 40,
  },
  version: {
    fontSize: 12,
    color: colors.textDim,
  },
});
