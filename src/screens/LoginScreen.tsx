// src/screens/LoginScreen.tsx
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ActivityIndicator, 
  Alert,
  Platform
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { AuthService } from '../services/AuthService';
import { FontAwesome5 } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { CrashLogger } from '../services/LoggingService';

type LoginScreenNavigationProp = StackNavigationProp<AuthStackParamList, 'Login'>;

interface LoginScreenProps {
  navigation: LoginScreenNavigationProp;
}

/**
 * LoginScreen
 * ---------------------------------------------------------------------------
 * The email/password sign-in screen and entry point of the unauthenticated
 * (Auth) navigation stack. Also offers a "forgot password" reset-email flow
 * and a link into the CreateProfile signup flow.
 *
 * Navigation:
 * - Route: `AuthStackParamList['Login']`, no params.
 * - "Sign Up" link navigates to `CreateProfile` (no params).
 * - On successful login there is no explicit navigation call — signing in
 *   updates the Supabase Auth session, which `useAuth`'s
 *   `onAuthStateChange` listener picks up, causing `RootNavigator` to swap
 *   from the Auth stack to the authenticated app tabs automatically.
 *
 * Validation/business rules:
 * - Both email and password are required before attempting login.
 * - Auth errors from Supabase are translated to user-friendly copy by
 *   `AuthService.login` (via `mapAuthError`) and shown verbatim in an Alert.
 * - "Forgot password" requires an email to already be typed in the email
 *   field (no separate prompt) before it will send a reset email via
 *   `AuthService.sendPasswordReset`.
 */
export const LoginScreen = ({ navigation }: LoginScreenProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  /**
   * Validates required fields then delegates to `AuthService.login`
   * (Supabase `signInWithPassword`). On success, no explicit action is
   * needed here — see the screen-level note on how the auth-state listener
   * takes over navigation. On failure, the mapped error message is shown to
   * the user via Alert.
   */
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Error', 'Please fill in all fields.');
      return;
    }

    setLoading(true);
    try {
      await AuthService.login(email, password);
    } catch (error: any) {
      CrashLogger.error(error);
      Alert.alert('Authentication Failed', error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollView 
      style={styles.container}
      contentContainerStyle={{ flexGrow: 1 }}
      enableOnAndroid={true}
      extraScrollHeight={20}
    >
      <View style={styles.content}>
        <Text style={styles.title}>Welcome Back</Text>
        <Text style={styles.subtitle}>Sign in to view your lists.</Text>

        <View style={styles.inputWrapper}>
          <FontAwesome5 name="envelope" size={18} color={colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Email Address"
            placeholderTextColor={colors.textDim}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
        </View>
 
        <View style={styles.inputWrapper}>
          <FontAwesome5 name="lock" size={18} color={colors.textDim} style={styles.inputIcon} />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={colors.textDim}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
        </View>
        
        <TouchableOpacity 
          style={styles.button} 
          onPress={handleLogin} 
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Login</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={async () => {
            if (!email) { Alert.alert('Enter your email first'); return; }
            try {
              await AuthService.sendPasswordReset(email);
              Alert.alert('Email Sent', 'Check your inbox for a password reset link.');
            } catch (e: any) {
              Alert.alert('Error', e.message);
            }
          }}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>Forgot password?</Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => navigation.navigate('CreateProfile')}
          style={styles.switchContainer}
        >
          <Text style={styles.switchText}>Don't have an account? Sign Up</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 8,
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 32,
    color: colors.textDim,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    position: 'relative',
  },
  inputIcon: {
    position: 'absolute',
    left: 16,
    zIndex: 1,
  },
  input: {
    flex: 1,
    padding: 16,
    paddingLeft: 48,
    fontSize: 16,
    color: colors.text,
  },
  button: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
    backgroundColor: colors.primary,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  switchContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  switchText: {
    fontSize: 14,
    color: colors.textDim,
  },
});