import React, { useState, useEffect, useLayoutEffect, useMemo, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { FontAwesome5 } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import {
  DEFAULT_EVENT_CONFIGS,
  NOTIFICATION_EVENT_META,
  NOTIFICATION_KIND_OPTIONS,
  mergeNotificationPreferences,
} from '../constants/notifications';
import { useNotifications } from '../hooks/useNotifications';
import { NotificationService, renderNotificationTemplate } from '../services/NotificationService';
import { CrashLogger } from '../services/LoggingService';
import { useAppTheme, ThemeColors } from '../theme/ThemeContext';
import {
  NotificationEventConfig,
  NotificationEventMeta,
  NotificationEventType,
  NotificationKind,
  NotificationPreferences,
} from '../types/notifications';

type FocusedField = 'title' | 'body';

export const NotificationSettingsScreen = () => {
  const navigation = useNavigation<any>();
  const { colors } = useAppTheme();
  const styles = createStyles(colors);
  const { preferences, savePreferences, showInAppBanner } = useNotifications();

  const [draft, setDraft] = useState<NotificationPreferences>(() =>
    mergeNotificationPreferences(preferences)
  );
  const [expandedEvent, setExpandedEvent] = useState<NotificationEventType | null>('new_message');
  const [focusedField, setFocusedField] = useState<Record<string, FocusedField>>({});
  const [permissionGranted, setPermissionGranted] = useState<boolean>(true);
  const [saving, setSaving] = useState(false);

  const hasSavedRef = useRef(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    setDraft(mergeNotificationPreferences(preferences));
  }, [preferences]);

  useEffect(() => {
    NotificationService.getPermissionStatus()
      .then((status) => setPermissionGranted(status === 'granted'))
      .catch(() => setPermissionGranted(false));
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(preferences),
    [draft, preferences]
  );

  // Hide bottom tab bar while editing notification settings
  useLayoutEffect(() => {
    const parent = navigation.getParent();
    parent?.setOptions({ tabBarStyle: { display: 'none' } });
    return () => {
      parent?.setOptions({
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border },
      });
    };
  }, [navigation, colors]);

  const persistDraft = useCallback(
    async (nextPrefs: NotificationPreferences): Promise<boolean> => {
      try {
        setSaving(true);
        await savePreferences(nextPrefs);
        return true;
      } catch (err: any) {
        CrashLogger.error(err, 'NotificationSettingsScreen.persistDraft');
        Alert.alert('Save Issue', err?.message || 'Could not save notification preferences.');
        return false;
      } finally {
        setSaving(false);
      }
    },
    [savePreferences]
  );

  const handleBack = useCallback(async () => {
    if (isDirty && !hasSavedRef.current) {
      hasSavedRef.current = true;
      const ok = await persistDraft(draftRef.current);
      if (!ok) {
        hasSavedRef.current = false;
        return;
      }
    }
    navigation.goBack();
  }, [isDirty, navigation, persistDraft]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: 'Notification Preferences',
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
      headerRight: () =>
        saving ? (
          <View style={{ marginRight: 16 }}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : isDirty ? (
          <TouchableOpacity onPress={handleBack} style={{ marginRight: 16 }}>
            <Text style={{ color: colors.primary, fontWeight: 'bold', fontSize: 15 }}>Save</Text>
          </TouchableOpacity>
        ) : null,
    });
  }, [navigation, colors, isDirty, saving, handleBack, styles.backButton]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', async (e: any) => {
      if (!hasSavedRef.current && isDirty) {
        e.preventDefault();
        hasSavedRef.current = true;
        const ok = await persistDraft(draftRef.current);
        if (ok) {
          navigation.dispatch(e.data.action);
        } else {
          hasSavedRef.current = false;
        }
      }
    });
    return unsubscribe;
  }, [navigation, isDirty, persistDraft]);

  const updateEventConfig = (
    eventType: NotificationEventType,
    patch: Partial<NotificationEventConfig>
  ) => {
    setDraft((prev) => ({
      ...prev,
      events: {
        ...prev.events,
        [eventType]: {
          ...prev.events[eventType],
          ...patch,
        },
      },
    }));
  };

  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermissions();
    setPermissionGranted(granted);
    if (!granted) {
      Alert.alert(
        'Permissions Required',
        'Enable notifications in your device settings to receive system alerts.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleInsertVariable = (eventType: NotificationEventType, variableKey: string) => {
    const targetField = focusedField[eventType] ?? 'body';
    const token = `{{${variableKey}}}`;
    const current = draft.events[eventType];
    if (targetField === 'title') {
      updateEventConfig(eventType, { titleTemplate: `${current.titleTemplate} ${token}`.trimStart() });
    } else {
      updateEventConfig(eventType, { bodyTemplate: `${current.bodyTemplate} ${token}`.trimStart() });
    }
  };

  const handleResetEvent = (eventType: NotificationEventType) => {
    updateEventConfig(eventType, { ...DEFAULT_EVENT_CONFIGS[eventType] });
  };

  const handleTestNotification = async (meta: NotificationEventMeta) => {
    try {
      const config = draft.events[meta.type];
      await NotificationService.sendTestNotification(meta.type, config, showInAppBanner);
    } catch (err: any) {
      Alert.alert('Notification Test', err?.message || 'Unable to send test notification.');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={true}
    >
      {!permissionGranted && (
        <View style={styles.permissionCard}>
          <FontAwesome5 name="exclamation-triangle" size={18} color={colors.danger} style={{ marginRight: 12 }} />
          <View style={{ flex: 1 }}>
            <Text style={styles.permissionTitle}>System Notifications Disabled</Text>
            <Text style={styles.permissionSubtitle}>
              Grant permission so Android can display alerts and action buttons outside the app.
            </Text>
            <TouchableOpacity style={styles.permissionBtn} onPress={handleRequestPermission}>
              <Text style={styles.permissionBtnText}>Enable System Notifications</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <View style={styles.masterCard}>
        <View style={styles.masterRow}>
          <View style={{ flex: 1, marginRight: 12 }}>
            <Text style={styles.masterTitle}>Receive Event Notifications</Text>
            <Text style={styles.masterSubtitle}>
              Subscribe to real-time updates, choose how alerts are delivered, and customize messages.
            </Text>
          </View>
          <Switch
            value={draft.globalEnabled}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, globalEnabled: value }))}
            trackColor={{ false: colors.border, true: colors.primary + '80' }}
            thumbColor={draft.globalEnabled ? colors.primary : colors.textDim}
          />
        </View>
      </View>

      {NOTIFICATION_EVENT_META.map((meta) => {
        const config = draft.events[meta.type];
        const isExpanded = expandedEvent === meta.type;
        const sampleVars: Record<string, string> = {};
        meta.variables.forEach((v) => {
          sampleVars[v.key] = v.sample;
        });

        const previewTitle = renderNotificationTemplate(config.titleTemplate, sampleVars) || 'GiftListApp';
        const previewBody = renderNotificationTemplate(config.bodyTemplate, sampleVars);

        return (
          <View
            key={meta.type}
            style={[styles.eventCard, !draft.globalEnabled && styles.eventCardDisabled]}
          >
            <TouchableOpacity
              style={styles.eventHeader}
              activeOpacity={0.75}
              onPress={() => setExpandedEvent(isExpanded ? null : meta.type)}
            >
              <View style={[styles.iconCircle, config.enabled && { backgroundColor: colors.primary + '20' }]}>
                <FontAwesome5
                  name={meta.icon}
                  size={16}
                  color={config.enabled ? colors.primary : colors.textDim}
                />
              </View>

              <View style={{ flex: 1, marginHorizontal: 12 }}>
                <Text style={styles.eventTitle}>{meta.label}</Text>
                <Text style={styles.eventDescription}>{meta.description}</Text>
              </View>

              <Switch
                value={config.enabled}
                disabled={!draft.globalEnabled}
                onValueChange={(enabled) => {
                  updateEventConfig(meta.type, { enabled });
                  if (enabled) setExpandedEvent(meta.type);
                }}
                trackColor={{ false: colors.border, true: colors.primary + '80' }}
                thumbColor={config.enabled ? colors.primary : colors.textDim}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.expandHintRow}
              onPress={() => setExpandedEvent(isExpanded ? null : meta.type)}
            >
              <Text style={styles.expandHintText}>
                {isExpanded ? 'Hide customization' : `Customize wording & type (${config.kind})`}
              </Text>
              <FontAwesome5
                name={isExpanded ? 'chevron-up' : 'chevron-down'}
                size={12}
                color={colors.textDim}
              />
            </TouchableOpacity>

            {isExpanded && (
              <View style={styles.eventBody}>
                <Text style={styles.fieldLabel}>Notification Kind</Text>
                <View style={styles.kindGrid}>
                  {NOTIFICATION_KIND_OPTIONS.map((option) => {
                    const selected = config.kind === option.value;
                    return (
                      <TouchableOpacity
                        key={option.value}
                        style={[
                          styles.kindChip,
                          selected && {
                            borderColor: colors.primary,
                            backgroundColor: colors.primary + '16',
                          },
                        ]}
                        onPress={() =>
                          updateEventConfig(meta.type, { kind: option.value as NotificationKind })
                        }
                      >
                        <FontAwesome5
                          name={option.icon}
                          size={12}
                          color={selected ? colors.primary : colors.textDim}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          style={[
                            styles.kindChipText,
                            selected && { color: colors.primary, fontWeight: '700' },
                          ]}
                        >
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Text style={styles.helperText}>
                  {NOTIFICATION_KIND_OPTIONS.find((o) => o.value === config.kind)?.description}
                </Text>

                <Text style={styles.fieldLabel}>Notification Title</Text>
                <TextInput
                  style={styles.input}
                  value={config.titleTemplate}
                  onFocus={() => setFocusedField((prev) => ({ ...prev, [meta.type]: 'title' }))}
                  onChangeText={(titleTemplate) => updateEventConfig(meta.type, { titleTemplate })}
                  placeholder="Enter notification title..."
                  placeholderTextColor={colors.textDim}
                />

                <Text style={styles.fieldLabel}>Notification Message</Text>
                <TextInput
                  style={[styles.input, styles.multilineInput]}
                  value={config.bodyTemplate}
                  onFocus={() => setFocusedField((prev) => ({ ...prev, [meta.type]: 'body' }))}
                  onChangeText={(bodyTemplate) => updateEventConfig(meta.type, { bodyTemplate })}
                  placeholder="Enter notification body..."
                  placeholderTextColor={colors.textDim}
                  multiline
                />

                {meta.variables.length > 0 && (
                  <View style={styles.variablesSection}>
                    <Text style={styles.helperText}>Tap a placeholder to insert into the active field:</Text>
                    <View style={styles.variablesRow}>
                      {meta.variables.map((v) => (
                        <TouchableOpacity
                          key={v.key}
                          style={styles.varChip}
                          onPress={() => handleInsertVariable(meta.type, v.key)}
                        >
                          <Text style={styles.varChipText}>{`{{${v.key}}}`}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                <View style={styles.previewBox}>
                  <Text style={styles.previewLabel}>Live Preview</Text>
                  <Text style={styles.previewTitle}>{previewTitle}</Text>
                  {Boolean(previewBody) && <Text style={styles.previewBody}>{previewBody}</Text>}
                </View>

                {meta.supportsActions && config.kind !== 'in_app' && (
                  <View style={styles.actionsRow}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={styles.actionsTitle}>Include Interactive Buttons</Text>
                      <Text style={styles.helperText}>{meta.actionSummary}</Text>
                    </View>
                    <Switch
                      value={config.includeActions}
                      onValueChange={(includeActions) =>
                        updateEventConfig(meta.type, { includeActions })
                      }
                      trackColor={{ false: colors.border, true: colors.primary + '80' }}
                      thumbColor={config.includeActions ? colors.primary : colors.textDim}
                    />
                  </View>
                )}

                <View style={styles.cardFooterRow}>
                  <TouchableOpacity
                    style={styles.secondaryBtn}
                    onPress={() => handleResetEvent(meta.type)}
                  >
                    <FontAwesome5 name="undo" size={12} color={colors.textDim} style={{ marginRight: 6 }} />
                    <Text style={styles.secondaryBtnText}>Reset Default</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.testBtn}
                    onPress={() => handleTestNotification(meta)}
                  >
                    <FontAwesome5 name="paper-plane" size={12} color="#fff" style={{ marginRight: 6 }} />
                    <Text style={styles.testBtnText}>Send Test</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        );
      })}
    </ScrollView>
  );
};

const createStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    content: { padding: 16, paddingBottom: 80 },
    backButton: { paddingHorizontal: 16, paddingVertical: 8 },
    permissionCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: colors.card,
      borderColor: colors.danger,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 14,
    },
    permissionTitle: { fontSize: 14, fontWeight: '700', color: colors.text, marginBottom: 4 },
    permissionSubtitle: { fontSize: 12, color: colors.textDim, lineHeight: 17, marginBottom: 10 },
    permissionBtn: {
      alignSelf: 'flex-start',
      backgroundColor: colors.danger,
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 8,
    },
    permissionBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    masterCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    masterRow: { flexDirection: 'row', alignItems: 'center' },
    masterTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 4 },
    masterSubtitle: { fontSize: 13, color: colors.textDim, lineHeight: 18 },
    eventCard: {
      backgroundColor: colors.card,
      borderColor: colors.border,
      borderWidth: 1,
      borderRadius: 12,
      padding: 14,
      marginBottom: 12,
    },
    eventCardDisabled: { opacity: 0.6 },
    eventHeader: { flexDirection: 'row', alignItems: 'center' },
    iconCircle: {
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    eventTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
    eventDescription: { fontSize: 12, color: colors.textDim, marginTop: 2, lineHeight: 16 },
    expandHintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    expandHintText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    eventBody: { marginTop: 12 },
    fieldLabel: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      marginTop: 10,
      marginBottom: 6,
    },
    kindGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    kindChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 7,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    kindChipText: { fontSize: 12, fontWeight: '600', color: colors.text },
    helperText: { fontSize: 11, color: colors.textDim, marginTop: 4, lineHeight: 15 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.background,
    },
    multilineInput: { minHeight: 62, textAlignVertical: 'top' },
    variablesSection: { marginTop: 8 },
    variablesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    varChip: {
      backgroundColor: colors.primary + '16',
      borderColor: colors.primary + '40',
      borderWidth: 1,
      borderRadius: 14,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    varChipText: { fontSize: 11, fontWeight: '700', color: colors.primary },
    previewBox: {
      marginTop: 12,
      padding: 12,
      borderRadius: 10,
      backgroundColor: colors.background,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewLabel: {
      fontSize: 10,
      fontWeight: '700',
      textTransform: 'uppercase',
      color: colors.textDim,
      marginBottom: 4,
    },
    previewTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
    previewBody: { fontSize: 13, color: colors.textDim, marginTop: 2 },
    actionsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: 12,
      paddingTop: 10,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    actionsTitle: { fontSize: 13, fontWeight: '600', color: colors.text },
    cardFooterRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginTop: 14,
      gap: 10,
    },
    secondaryBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    secondaryBtnText: { fontSize: 13, fontWeight: '600', color: colors.textDim },
    testBtn: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 10,
      borderRadius: 8,
      backgroundColor: colors.primary,
    },
    testBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  });
