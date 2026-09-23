import React, { useState, useEffect } from 'react';
import { 
  Alert, 
  Platform, 
  StyleSheet, 
  ActivityIndicator, 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  Switch, 
  useColorScheme,
  SafeAreaView
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';

// Services
import { AuthService } from '../services/AuthService';
import { UserService, createDefaultUser } from '../services/UserService';
import { useAppTheme } from '../theme/ThemeContext';
import { CrashLogger } from '../services/LoggingService';

/**
 * CreateProfile
 * ---------------------------------------------------------------------------
 * Two-step account creation / onboarding flow: collects personal info +
 * COPPA (child-privacy) data in Step 1, then account credentials + legal
 * consent (Terms/Privacy/GDPR) in Step 2, and registers the user with
 * Supabase Auth + creates their `profiles` row.
 *
 * Navigation:
 * - Reached from `LoginScreen` via "Don't have an account? Sign Up"
 *   (`AuthStackParamList['CreateProfile']`, no params).
 * - Does not navigate away on success (see handleSubmitProfile) — once
 *   Supabase Auth's `onAuthStateChange` fires, `RootNavigator`/`useAuth`
 *   swaps the Auth stack for the authenticated app stack automatically.
 *
 * Local component: `Checkbox` is a small themed checkbox used for the
 * consent toggles in Step 2 (Terms, Privacy, GDPR data-processing consent).
 */
const Checkbox = ({ value, onValueChange, label, themeColors }: any) => (
  <TouchableOpacity 
    style={styles.checkboxRow} 
    onPress={() => onValueChange(!value)}
    activeOpacity={0.7}
  >
    <View style={[
      styles.checkboxBase, 
      { borderColor: themeColors.border, backgroundColor: value ? themeColors.primary : 'transparent' }
    ]}>
      {value && <FontAwesome5 name="check" size={12} color="#fff" />}
    </View>
    <Text style={[styles.checkboxLabel, { color: themeColors.text }]}>{label}</Text>
  </TouchableOpacity>
);

/**
 * Main two-step signup form.
 *
 * `step` (1 or 2) drives which fieldset is rendered; both steps share this
 * single component/state rather than being separate screens so validation
 * state (e.g. `isMinor`) computed in Step 1 stays available when Step 2
 * checks whether extra consent is required.
 *
 * `navigation` prop is accepted but currently unused directly — navigation
 * back to the app happens implicitly via the auth-state listener in
 * `useAuth`/`RootNavigator` once registration succeeds.
 */
export const CreateProfile = ({ navigation }: any) => {
  const { isDark: isDarkMode, colors} = useAppTheme();
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // --- Step 1: Personal Info ---
  const [displayName, setDisplayName] = useState('');
  const [givenName, setGivenName] = useState('');
  const [familyName, setFamilyName] = useState('');
  const [birthday, setBirthday] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isMinor, setIsMinor] = useState(false);
  const [parentEmail, setParentEmail] = useState('');

  // --- Step 2: Account Details & Compliance ---
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [checkingLocation, setCheckingLocation] = useState(false);
  const [isEUUser, setIsEUUser] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [acceptedDataProcessing, setAcceptedDataProcessing] = useState(false);

  // COPPA age check: whenever the birthday changes, recompute whether the
  // user is a minor (under 13) using a simple year-difference comparison
  // (not full month/day precision — good enough for gating the parental
  // consent field, not used as a legal age-verification system). Driving
  // `isMinor` from an effect (rather than inline) keeps it in sync even if
  // birthday is changed after the user already saw/dismissed the warning.
  useEffect(() => {
    if (birthday) {
      const year = birthday.getFullYear();
      const currentYear = new Date().getFullYear();
      setIsMinor((currentYear - year) < 13);
    } else {
      setIsMinor(false);
    }
  }, [birthday]);

  // GDPR region check: as soon as the user reaches Step 2, kick off an IP
  // geolocation lookup (ipapi.co) to pre-select "I am an EU/EEA resident" so
  // EU users see the mandatory data-processing consent checkbox without
  // having to know to look for it themselves. This is only a UX nicety/best
  // guess, not authoritative — the user can still toggle `isEUUser` off
  // manually, and a failed lookup silently leaves it `false` rather than
  // blocking the form.
  useEffect(() => {
    if (step === 2) {
      const checkLocation = async () => {
        setCheckingLocation(true);
        try {
          let response = await fetch('https://ipapi.co/json/');
          if (response.ok) {
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
              const data = await response.json();
              if (data && (data.in_eu || data.country_code === 'EU' || data.continent_code === 'EU')) {
                setIsEUUser(true);
              } else {
                setIsEUUser(false);
              }
            }
          }
        } catch (error) {
          // Geolocation check failed
          CrashLogger.error(error);
        } finally {
          setCheckingLocation(false);
        }
      };
      checkLocation();
    }
  }, [step]);

  /**
   * Validates Step 1 (personal info) before advancing to Step 2.
   *
   * Rules:
   * - Display name and birthday are required.
   * - COPPA: if the birthday computation flagged the user as a minor
   *   (`isMinor`), a parent/guardian email is mandatory before continuing —
   *   this is the app's parental-consent gate for under-13 users.
   */
  const handleNextStep1 = () => {
    if (!displayName || !birthday) {
      Alert.alert('Error', 'Please fill out your name and a valid birthday.');
      return;
    }
    if (isMinor && !parentEmail) {
      Alert.alert('COPPA Requirement', 'A parent or guardian email is required for users under 13.');
      return;
    }
    setStep(2);
  };

  /**
   * Validates Step 2 and completes registration: creates the Supabase Auth
   * user, then writes the full `User` profile (including compliance fields)
   * to the `profiles` table.
   *
   * Validation order (each step short-circuits with an Alert on failure):
   * 1. Basic — email/password/confirmPassword all present, passwords match,
   *    password length >= 6 (mirrors Supabase Auth's own minimum so the user
   *    gets the friendlier client-side message first).
   * 2. Compliance — Terms and Privacy Policy acceptance are mandatory for
   *    every user. If the location check flagged `isEUUser`, explicit GDPR
   *    data-processing consent (`acceptedDataProcessing`) is additionally
   *    required.
   * 3. Email-uniqueness pre-check via `AuthService.isEmailInUse` — advisory
   *    only (see AuthService docs); Supabase Auth's own `signUp` is still
   *    the final authority and can itself reject a duplicate email.
   * 4. Registration + profile creation.
   *
   * Firebase -> Supabase migration note: this used to call
   * `supabase.auth.getUser()` right after `signUp()` to get the new user's
   * id, which failed because there is no active session yet immediately
   * after sign-up (email confirmation pending, or auto-confirm not yet
   * propagated). It now uses the `{ id, email }` returned directly by
   * `AuthService.register()` instead, which comes from the `signUp` response
   * itself and doesn't depend on a session existing.
   */
  const handleSubmitProfile = async () => {
    // 1. Basic Validation
    if (!email || !password || !confirmPassword) {
      Alert.alert('Error', 'Please fill out all account fields.');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters.');
      return;
    }

    // 2. Compliance Validation
    if (!termsAccepted || !privacyAccepted) {
      Alert.alert('Error', 'You must accept the Terms and Privacy Policy to create an account.');
      return;
    }
    if (isEUUser && !acceptedDataProcessing) {
      Alert.alert('GDPR Requirement', 'EU Users must explicitly consent to data processing.');
      return;
    }

    setIsSubmitting(true);
    try {
      // 3. Email Uniqueness Check
      const isTaken = await AuthService.isEmailInUse(email);
      if (isTaken) {
        Alert.alert('Account Exists', 'An account with this email already exists. Please login instead.');
        setIsSubmitting(false);
        return;
      }

      // 4. Registration
      const authUser = await AuthService.register(email, password);

      const newUser = createDefaultUser(authUser.id, email);
      newUser.displayName = displayName;
      newUser.givenName = givenName;
      newUser.familyName = familyName;
      newUser.birthday = birthday ? birthday.toISOString() : null;
      newUser.minorProtection.isMinor = isMinor;
      newUser.minorProtection.parentEmail = parentEmail;
      newUser.legalAcceptance.termsAccepted = termsAccepted;
      newUser.legalAcceptance.privacyAccepted = privacyAccepted;
      newUser.legalAcceptance.acceptanceDate = new Date().toISOString();
      newUser.legalAcceptance.isEUUser = isEUUser;
      newUser.legalAcceptance.gdprApplies = isEUUser;
      newUser.legalAcceptance.acceptedDataProcessing = acceptedDataProcessing;

      await UserService.createUserProfile(newUser);
      Alert.alert('Success', 'Account created successfully!');
    } catch (error: any) {
      CrashLogger.error(error);
      Alert.alert('Registration Failed', error.message || "An unexpected error occurred.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const themeColors = {
    ...colors,
    subtext: colors.textDim
  };

  const renderProgressBar = () => {
    const progress = (step / 2) * 100;
    return (
      <View style={styles.progressContainer}>
        <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: themeColors.primary }]} />
      </View>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: themeColors.background }]}>
      {renderProgressBar()}
      <KeyboardAwareScrollView 
        style={styles.scrollView} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        extraScrollHeight={20}
      >
          <Text style={[styles.stepIndicator, { color: themeColors.subtext }]}>Step {step} of 2</Text>

          {/* STEP 1: PERSONAL INFO */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Personal Information</Text>
              
              <Text style={[styles.label, { color: themeColors.text }]}>Username</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="user" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="Your public handle"
                   placeholderTextColor="#888"
                   value={displayName}
                   onChangeText={setDisplayName}
                   autoCorrect={false}
                 />
              </View>

              <Text style={[styles.label, { color: themeColors.text }]}>First Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="id-card" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="Your given name"
                   placeholderTextColor="#888"
                   value={givenName}
                   onChangeText={setGivenName}
                   autoCorrect={false}
                 />
              </View>

              <Text style={[styles.label, { color: themeColors.text }]}>Last Name</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="id-card" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="Your family name"
                   placeholderTextColor="#888"
                   value={familyName}
                   onChangeText={setFamilyName}
                   autoCorrect={false}
                 />
              </View>

              <Text style={[styles.label, { color: themeColors.text }]}>Birthday</Text>
              <TouchableOpacity onPress={() => setShowDatePicker(true)} activeOpacity={0.7}>
                <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border, minHeight: 48, justifyContent: 'center' }]}>
                  <FontAwesome5 name="calendar-alt" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                  <Text style={{ color: birthday ? themeColors.text : '#888', marginLeft: 12 }}>
                    {birthday ? birthday.toLocaleDateString() : 'Select your birthday'}
                  </Text>
                </View>
              </TouchableOpacity>

              {showDatePicker && (
                <DateTimePicker
                  value={birthday || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={(event: any, selectedDate?: Date) => {
                    if (Platform.OS === 'android') setShowDatePicker(false);
                    if (selectedDate) setBirthday(selectedDate);
                  }}
                />
              )}
              {Platform.OS === 'ios' && showDatePicker && (
                <TouchableOpacity onPress={() => setShowDatePicker(false)} style={{ marginBottom: 10 }}>
                  <Text style={{ color: themeColors.primary, textAlign: 'center' }}>Done</Text>
                </TouchableOpacity>
              )}

              {isMinor && (
                <View style={[styles.warningBox, { backgroundColor: isDarkMode ? '#4a1c1c' : '#ffe5e5' }]}>
                  <View style={styles.warningHeader}>
                    <FontAwesome5 name="exclamation-triangle" size={14} color={isDarkMode ? '#ff8888' : '#cc0000'} />
                    <Text style={[styles.warningTitle, { color: isDarkMode ? '#ff8888' : '#cc0000' }]}>
                      Parental Consent Required
                    </Text>
                  </View>
                  <Text style={[styles.warningText, { color: themeColors.text }]}>
                    A parent or guardian must approve your account under COPPA laws.
                  </Text>
                  <Text style={[styles.label, { color: themeColors.text }]}>Parent's Email Address</Text>
                  <TextInput
                    style={[styles.inputAlt, { borderColor: themeColors.border, backgroundColor: themeColors.card, color: themeColors.text }]}
                    placeholderTextColor="#888"
                    placeholder="parent@example.com"
                    value={parentEmail}
                    onChangeText={setParentEmail}
                    autoCapitalize="none"
                    keyboardType="email-address"
                  />
                </View>
              )}

              <TouchableOpacity 
                style={[styles.mainButton, { backgroundColor: themeColors.primary }]} 
                onPress={handleNextStep1}
              >
                <Text style={styles.mainButtonText}>Continue</Text>
                <FontAwesome5 name="arrow-right" size={14} color="#fff" style={{ marginLeft: 8 }} />
              </TouchableOpacity>
            </View>
          )}

          {/* STEP 2: ACCOUNT INFO & COMPLIANCE */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={[styles.sectionTitle, { color: themeColors.text }]}>Account & Security</Text>
              
              <Text style={[styles.label, { color: themeColors.text }]}>Email Address</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="envelope" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="email@example.com"
                   placeholderTextColor="#888"
                   value={email}
                   onChangeText={setEmail}
                   autoCapitalize="none"
                   keyboardType="email-address"
                 />
              </View>

              <Text style={[styles.label, { color: themeColors.text }]}>Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="lock" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="••••••••"
                   placeholderTextColor="#888"
                   value={password}
                   onChangeText={setPassword}
                   secureTextEntry
                 />
              </View>

              <Text style={[styles.label, { color: themeColors.text }]}>Confirm Password</Text>
              <View style={[styles.inputWrapper, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                 <FontAwesome5 name="shield-alt" size={16} color={themeColors.subtext} style={styles.inputIcon} />
                 <TextInput
                   style={[styles.input, { color: themeColors.text }]}
                   placeholder="••••••••"
                   placeholderTextColor="#888"
                   value={confirmPassword}
                   onChangeText={setConfirmPassword}
                   secureTextEntry
                 />
              </View>

              <View style={{ marginTop: 24 }}>
                <Text style={[styles.sectionTitle, { color: themeColors.text, fontSize: 18, marginBottom: 16 }]}>Legal & Compliance</Text>
                
                {checkingLocation ? (
                  <View style={{ marginBottom: 20, flexDirection: 'row', alignItems: 'center' }}>
                    <ActivityIndicator size="small" color={themeColors.primary} />
                    <Text style={{ color: themeColors.subtext, marginLeft: 10 }}>Checking regional requirements...</Text>
                  </View>
                ) : (
                  <>
                    {isEUUser && (
                       <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border, marginBottom: 16 }]}>
                         <Checkbox 
                           value={isEUUser} 
                           onValueChange={setIsEUUser} 
                           label="I am an EU/EEA resident" 
                           themeColors={themeColors} 
                         />
                         <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 12 }}>
                           <Checkbox 
                             value={acceptedDataProcessing} 
                             onValueChange={setAcceptedDataProcessing} 
                             label="I consent to the processing of my data under GDPR regulations."
                             themeColors={themeColors} 
                           />
                         </View>
                       </View>
                    )}

                    <View style={[styles.card, { backgroundColor: themeColors.card, borderColor: themeColors.border }]}>
                       <Checkbox 
                         value={termsAccepted} 
                         onValueChange={setTermsAccepted} 
                         label="I agree to the Terms of Service *"
                         themeColors={themeColors} 
                       />
                       <View style={{ marginTop: 12, borderTopWidth: 1, borderTopColor: themeColors.border, paddingTop: 12 }}>
                         <Checkbox 
                           value={privacyAccepted} 
                           onValueChange={setPrivacyAccepted} 
                           label="I have read and accept the Privacy Policy *"
                           themeColors={themeColors} 
                         />
                       </View>
                    </View>
                  </>
                )}
              </View>

              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.outlineButton, { borderColor: themeColors.border }]} 
                  onPress={() => setStep(1)}
                  disabled={isSubmitting}
                >
                  <Text style={[styles.outlineButtonText, { color: themeColors.text }]}>Back</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.mainButton, { backgroundColor: isSubmitting ? '#999' : themeColors.primary, flex: 2 }]} 
                  onPress={handleSubmitProfile}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.mainButtonText}>Create Account</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
      </KeyboardAwareScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  progressContainer: {
    height: 4,
    width: '100%',
    backgroundColor: '#e0e0e0',
  },
  progressBar: {
    height: '100%',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 24,
    paddingTop: 12,
  },
  stepIndicator: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'right',
  },
  stepContainer: {
    width: '100%',
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    marginBottom: 20,
    height: 52,
  },
  inputIcon: {
    width: 20,
    textAlign: 'center',
  },
  input: {
    flex: 1,
    height: '100%',
    fontSize: 16,
    marginLeft: 12,
  },
  inputAlt: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    height: 48,
  },
  mainButton: {
    height: 52,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  mainButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 30,
    gap: 12,
  },
  outlineButton: {
    flex: 1,
    height: 52,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    backgroundColor: 'transparent',
  },
  outlineButtonText: {
    fontWeight: '600',
    fontSize: 16,
  },
  warningBox: {
    padding: 16,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(204, 0, 0, 0.1)',
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  warningTitle: {
    fontWeight: 'bold',
    marginLeft: 8,
    fontSize: 15,
  },
  warningText: {
    fontSize: 14,
    marginBottom: 16,
    lineHeight: 20,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    elevation: 1,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkboxBase: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    marginLeft: 12,
    fontSize: 14,
    flex: 1,
  },
});