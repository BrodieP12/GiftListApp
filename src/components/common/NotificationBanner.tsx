import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme, ThemeColors } from '../../theme/ThemeContext';
import { NOTIFICATION_EVENT_META } from '../../constants/notifications';
import { InAppNotificationPayload } from '../../types/notifications';

interface NotificationBannerProps {
  notification: InAppNotificationPayload | null;
  onPress: (notification: InAppNotificationPayload) => void;
  onDismiss: () => void;
}

export const NotificationBanner = ({
  notification,
  onPress,
  onDismiss,
}: NotificationBannerProps) => {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const styles = createStyles(colors, insets.top);

  if (!notification) return null;

  const meta = NOTIFICATION_EVENT_META.find((item) => item.type === notification.eventType);
  const iconName = meta?.icon ?? 'bell';

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      <TouchableOpacity
        style={styles.banner}
        activeOpacity={0.9}
        onPress={() => onPress(notification)}
        accessibilityRole="button"
        accessibilityLabel={`${notification.title}. ${notification.body}`}
      >
        <View style={styles.iconCircle}>
          <FontAwesome5 name={iconName} size={16} color={colors.primary} />
        </View>

        <View style={styles.textContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {notification.title}
          </Text>
          {Boolean(notification.body) && (
            <Text style={styles.body} numberOfLines={2}>
              {notification.body}
            </Text>
          )}
        </View>

        <TouchableOpacity
          onPress={onDismiss}
          style={styles.closeButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityLabel="Dismiss notification"
        >
          <FontAwesome5 name="times" size={14} color={colors.textDim} />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
};

const createStyles = (colors: ThemeColors, topInset: number) =>
  StyleSheet.create({
    wrapper: {
      position: 'absolute',
      top: Math.max(topInset, 12) + 8,
      left: 16,
      right: 16,
      zIndex: 9999,
      elevation: 10,
    },
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderColor: colors.primary,
      borderWidth: 1,
      borderRadius: 14,
      padding: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.18,
      shadowRadius: 8,
      elevation: 8,
    },
    iconCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.primary + '1A',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    textContainer: {
      flex: 1,
      marginRight: 8,
    },
    title: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    body: {
      fontSize: 13,
      color: colors.textDim,
      marginTop: 2,
      lineHeight: 18,
    },
    closeButton: {
      padding: 4,
    },
  });
