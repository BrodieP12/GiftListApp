import React, { useState, useEffect, useLayoutEffect, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../hooks/useAuth';
import { UserService } from '../services/UserService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import { CrashLogger } from '../services/LoggingService';
import {
  SUPPORTED_RETAILERS,
  DEFAULT_PREFERRED_RETAILERS,
  RetailerOption,
} from '../constants/retailers';

/**
 * AccountSettingsScreen
 * ---------------------------------------------------------------------------
 * Global user account settings screen for configuring preferred retailer stores
 * used by the product extractor.
 *
 * Behaviors:
 * - Hides the bottom tab bar when active.
 * - Stores preferences in Supabase (`public.profiles.preferred_retailers`),
 *   syncing across all devices.
 * - Auto-saves to the user's account whenever the back button or back gesture is used.
 */
export const AccountSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { user, updateUserPreferences } = useAuth();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);

  const initialRetailers = useMemo(() => {
    if (user?.preferredRetailers && user.preferredRetailers.length > 0) {
      return [...user.preferredRetailers];
    }
    return [...DEFAULT_PREFERRED_RETAILERS];
  }, [user?.preferredRetailers]);

  const [selectedRetailers, setSelectedRetailers] = useState<string[]>(initialRetailers);
  const [customDomain, setCustomDomain] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState(false);

  // Track if changes were made
  const hasSavedRef = useRef(false);
  const selectedRetailersRef = useRef(selectedRetailers);
  selectedRetailersRef.current = selectedRetailers;

  const isDirty = useMemo(() => {
    if (selectedRetailers.length !== initialRetailers.length) return true;
    const sortedA = [...selectedRetailers].sort();
    const sortedB = [...initialRetailers].sort();
    return sortedA.some((val, idx) => val !== sortedB[idx]);
  }, [selectedRetailers, initialRetailers]);

  // 1. Hide the bottom navigation bar while this settings screen is active
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({
      tabBarStyle: { display: 'none' },
    });
    return () => {
      parent?.setOptions({
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      });
    };
  }, [navigation, colors]);

  // 2. Commit store preferences to Supabase (with automatic local fallback)
  const persistSettings = async (retailersToSave: string[]): Promise<boolean> => {
    if (!user?.uid) return false;
    try {
      setSaving(true);
      await UserService.updatePreferredRetailers(user.uid, retailersToSave);
      updateUserPreferences(retailersToSave);
      return true;
    } catch (err: any) {
      CrashLogger.error(err, 'AccountSettingsScreen.persistSettings');
      const msg = err?.message || 'Could not save store preferences. Please try again.';
      Alert.alert('Save Issue', msg);
      return false;
    } finally {
      setSaving(false);
    }
  };

  // 3. Custom back button and gesture listener that saves on back
  const handleBack = async () => {
    if (isDirty && !hasSavedRef.current) {
      hasSavedRef.current = true;
      const success = await persistSettings(selectedRetailersRef.current);
      if (!success) {
        hasSavedRef.current = false;
        return;
      }
    }
    navigation.goBack();
  };

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Store Preferences',
      headerLeft: () => (
        <TouchableOpacity
          onPress={handleBack}
          style={styles.backButton}
          accessibilityLabel="Back and save"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <FontAwesome5 name="arrow-left" size={18} color={colors.text} />
        </TouchableOpacity>
      ),
      headerRight: () => (
        saving ? (
          <View style={{ marginRight: 16 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : isDirty ? (
          <TouchableOpacity onPress={handleBack} style={{ marginRight: 16 }}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15 }}>Save</Text>
          </TouchableOpacity>
        ) : null
      ),
    });
  }, [navigation, colors, isDirty, saving]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e: any) => {
      if (!hasSavedRef.current && isDirty) {
        e.preventDefault();
        hasSavedRef.current = true;
        const success = await persistSettings(selectedRetailersRef.current);
        if (success) {
          navigation.dispatch(e.data.action);
        } else {
          hasSavedRef.current = false;
        }
      }
    });
    return unsubscribe;
  }, [navigation, isDirty]);

  // Toggle retailer selection
  const toggleRetailer = (domain: string) => {
    setSelectedRetailers((prev) =>
      prev.includes(domain) ? prev.filter((d) => d !== domain) : [...prev, domain]
    );
  };

  // Preset actions
  const selectRecommended = () => {
    setSelectedRetailers([...DEFAULT_PREFERRED_RETAILERS]);
  };

  const selectAll = () => {
    const all = SUPPORTED_RETAILERS.map((r) => r.domain);
    // Include existing custom domains
    const customOnes = selectedRetailers.filter(
      (d) => !SUPPORTED_RETAILERS.some((sr) => sr.domain === d)
    );
    setSelectedRetailers(Array.from(new Set([...all, ...customOnes])));
  };

  const clearAll = () => {
    setSelectedRetailers([]);
  };

  // Add custom store domain
  const handleAddCustomDomain = () => {
    const clean = customDomain
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0];

    if (!clean || !clean.includes('.')) {
      Alert.alert('Invalid Domain', 'Please enter a valid store domain like "microcenter.com"');
      return;
    }

    if (selectedRetailers.includes(clean)) {
      Alert.alert('Already Added', `${clean} is already in your preferred stores.`);
      return;
    }

    setSelectedRetailers((prev) => [...prev, clean]);
    setCustomDomain('');
  };

  // Group retailers by category
  const categories = useMemo(() => {
    const map = new Map<string, RetailerOption[]>();
    for (const r of SUPPORTED_RETAILERS) {
      const list = map.get(r.category) ?? [];
      list.push(r);
      map.set(r.category, list);
    }
    return Array.from(map.entries());
  }, []);

  // Custom added stores not in supported catalog
  const customAddedStores = useMemo(() => {
    return selectedRetailers.filter(
      (d) => !SUPPORTED_RETAILERS.some((sr) => sr.domain === d)
    );
  }, [selectedRetailers]);

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={true}
      nestedScrollEnabled={true}
      overScrollMode="always"
      bounces={true}
    >
      {/* Informational Cloud Banner */}
      <View style={styles.banner}>
        <FontAwesome5 name="cloud" size={20} color={colors.primary} style={styles.bannerIcon} />
        <View style={{ flex: 1 }}>
          <Text style={styles.bannerTitle}>Synced with Your Account</Text>
          <Text style={styles.bannerText}>
            These store preferences are saved directly to your account in the cloud. The product
            extractor will prioritize these retailers whenever you search for gifts.
          </Text>
        </View>
      </View>

      {/* Preset Action Bar */}
      <View style={styles.presetBar}>
        <TouchableOpacity style={styles.presetBtn} onPress={selectRecommended}>
          <FontAwesome5 name="star" size={13} color={colors.primary} style={{ marginRight: 6 }} />
          <Text style={[styles.presetBtnText, { color: colors.primary }]}>Recommended</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetBtn} onPress={selectAll}>
          <Text style={styles.presetBtnText}>Select All</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.presetBtn} onPress={clearAll}>
          <Text style={[styles.presetBtnText, { color: colors.textDim }]}>Clear All</Text>
        </TouchableOpacity>
      </View>

      {/* Custom Store Input */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Add Custom Store</Text>
        <Text style={styles.cardSubtitle}>
          Want to extract product links from a store not listed below?
        </Text>
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={customDomain}
            onChangeText={setCustomDomain}
            placeholder="e.g. bhphotovideo.com"
            placeholderTextColor={colors.textDim}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <TouchableOpacity style={styles.addBtn} onPress={handleAddCustomDomain}>
            <FontAwesome5 name="plus" size={14} color="#fff" />
            <Text style={styles.addBtnText}>Add</Text>
          </TouchableOpacity>
        </View>

        {customAddedStores.length > 0 && (
          <View style={{ marginTop: 12 }}>
            <Text style={styles.customStoresHeader}>Your Custom Stores:</Text>
            <View style={styles.chipsRow}>
              {customAddedStores.map((domain) => (
                <View key={domain} style={styles.customChip}>
                  <Text style={styles.customChipText}>{domain}</Text>
                  <TouchableOpacity
                    onPress={() => toggleRetailer(domain)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <FontAwesome5 name="times-circle" size={14} color={colors.textDim} />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>

      {/* Categorized Retailers */}
      {categories.map(([category, retailers]) => (
        <View key={category} style={styles.card}>
          <Text style={styles.categoryTitle}>{category}</Text>
          <View style={styles.grid}>
            {retailers.map((retailer) => {
              const isSelected = selectedRetailers.includes(retailer.domain);
              return (
                <TouchableOpacity
                  key={retailer.domain}
                  style={[
                    styles.retailerCard,
                    isSelected && {
                      borderColor: colors.primary,
                      backgroundColor: colors.primary + '12',
                    },
                  ]}
                  onPress={() => toggleRetailer(retailer.domain)}
                  activeOpacity={0.7}
                >
                  <View style={styles.retailerCardLeft}>
                    <View
                      style={[
                        styles.iconCircle,
                        isSelected && { backgroundColor: colors.primary + '25' },
                      ]}
                    >
                      <FontAwesome5
                        name={retailer.icon}
                        size={16}
                        color={isSelected ? colors.primary : colors.textDim}
                      />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                      <Text
                        style={[
                          styles.retailerName,
                          isSelected && { color: colors.primary, fontWeight: '700' },
                        ]}
                        numberOfLines={1}
                      >
                        {retailer.name}
                      </Text>
                      <Text style={styles.retailerDomain} numberOfLines={1}>
                        {retailer.domain}
                      </Text>
                    </View>
                  </View>

                  <FontAwesome5
                    name={isSelected ? 'check-circle' : 'circle'}
                    size={20}
                    color={isSelected ? colors.primary : colors.border}
                    solid={isSelected}
                  />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      {/* Footer Info */}
      <View style={styles.footerInfo}>
        <FontAwesome5 name="info-circle" size={14} color={colors.textDim} style={{ marginRight: 6 }} />
        <Text style={styles.footerInfoText}>
          Tapping the back button automatically saves these choices to your account.
        </Text>
      </View>
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    content: {
      flexGrow: 1,
      padding: 16,
      paddingBottom: 100,
    },
    backButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    banner: {
      flexDirection: 'row',
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      alignItems: 'center',
    },
    bannerIcon: {
      marginRight: 14,
    },
    bannerTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    bannerText: {
      fontSize: 13,
      color: colors.textDim,
      lineHeight: 18,
    },
    presetBar: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
      gap: 8,
    },
    presetBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingVertical: 10,
    },
    presetBtnText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    card: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    cardTitle: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 4,
    },
    cardSubtitle: {
      fontSize: 13,
      color: colors.textDim,
      marginBottom: 12,
    },
    inputRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
    },
    input: {
      flex: 1,
      height: 44,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    addBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 16,
      height: 44,
      borderRadius: 8,
      gap: 6,
    },
    addBtnText: {
      color: '#fff',
      fontWeight: '600',
      fontSize: 14,
    },
    customStoresHeader: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.textDim,
      marginBottom: 8,
    },
    chipsRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    customChip: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 10,
      paddingVertical: 6,
      gap: 6,
    },
    customChipText: {
      fontSize: 12,
      fontWeight: '600',
      color: colors.text,
    },
    categoryTitle: {
      fontSize: 15,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
    },
    grid: {
      gap: 8,
    },
    retailerCard: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 12,
      backgroundColor: colors.background,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: colors.border,
    },
    retailerCardLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.card,
      justifyContent: 'center',
      alignItems: 'center',
    },
    retailerName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
    },
    retailerDomain: {
      fontSize: 12,
      color: colors.textDim,
      marginTop: 2,
    },
    footerInfo: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 10,
      paddingHorizontal: 20,
    },
    footerInfoText: {
      fontSize: 12,
      color: colors.textDim,
      textAlign: 'center',
    },
  });
