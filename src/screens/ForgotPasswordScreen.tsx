// src/screens/ForgotPasswordScreen.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { FontAwesome5 } from '@expo/vector-icons';
import { StackNavigationProp } from '@react-navigation/stack';
import { AuthStackParamList } from '../navigation/AppNavigator';
import { AuthService } from '../services/AuthService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { CrashLogger } from '../services/LoggingService';

type Nav = StackNavigationProp<AuthStackParamList, 'ForgotPassword'>;

interface Props {
  navigation: Nav;
}

/**
 * Two-step password reset:
 *   'request' -> enter email, receive a 6-digit code by email
 *   'confirm' -> enter the code + a new password
 * Uses Supabase's recovery OTP flow (no deep links required).
 */
export const ForgotPasswordScreen = ({ navigation }: Props) => {
  const [step, setStep] = useState<'request' | 'confirm'>('request');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const handleSendCode = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email address.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.sendPasswordReset(email);
      Alert.alert(
        'Check your email',
        'If an account exists for that address, we sent a 6-digit reset code.'
      );
      setStep('confirm');
    } catch (error: any) {
      CrashLogger.error(error);
      Alert.alert('Could not send code', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async () => {
    if (!code.trim()) {
      Alert.alert('Error', 'Please enter the code from your email.');
      return;
    }
    if (newPassword.length < 6) {
      Alert.alert('Error', 'Password should be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      await AuthService.confirmPasswordReset(email, code, newPassword);
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'OK', onPress: () => navigation.navigate('Login') },
      ]);
    } catch (error: any) {
      CrashLogger.error(error);
      Alert.alert('Reset failed', error.message);
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
        <Text style={styles.title}>Reset Password</Text>
        <Text style={styles.subtitle}>
          {step === 'request'
            ? 'Enter your email and we’ll send you a reset code.'
            : `Enter the code sent to ${email} and choose a new password.`}
        </Text>

        {step === 'request' ? (
          <>
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

            <TouchableOpacity style={styles.button} onPress={handleSendCode} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Send Code</Text>}
            </TouchableOpacity>
          </>
        ) : (
          <>
            <View style={styles.inputWrapper}>
              <FontAwesome5 name="key" size={18} color={colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="6-digit code"
                placeholderTextColor={colors.textDim}
                value={code}
                onChangeText={setCode}
                autoCapitalize="none"
                keyboardType="number-pad"
              />
            </View>

            <View style={styles.inputWrapper}>
              <FontAwesome5 name="lock" size={18} color={colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="New Password"
                placeholderTextColor={colors.textDim}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
            </View>

            <View style={styles.inputWrapper}>
              <FontAwesome5 name="lock" size={18} color={colors.textDim} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Confirm New Password"
                placeholderTextColor={colors.textDim}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
            </View>

            <TouchableOpacity style={styles.button} onPress={handleConfirm} disabled={loading}>
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Update Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSendCode} style={styles.switchContainer} disabled={loading}>
              <Text style={styles.switchText}>Didn’t get a code? Resend</Text>
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.switchContainer}>
          <Text style={styles.switchText}>Back to Login</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAwareScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
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
