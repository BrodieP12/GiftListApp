/**
 * Button.tsx
 *
 * Shared, themed touchable button used throughout the app (auth screens,
 * modals, list/item actions, etc). Centralizes the app's button look and
 * feel — background color per `variant`, loading spinner state, optional
 * FontAwesome5 icon — so screens don't hand-roll TouchableOpacity styling.
 */
import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  StyleProp
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { useAppTheme } from '../../theme/ThemeContext';

/**
 * Props for {@link Button}.
 *
 * - `variant` drives the background/text color (see `getBackgroundColor`/
 *   `getTextColor` below): 'primary' uses the theme's primary color,
 *   'secondary' uses a soft/border color with theme text color, 'danger'
 *   uses the theme's danger color. Ignored (replaced with the disabled
 *   color) when `disabled` is true.
 * - `loading` swaps the label/icon for an `ActivityIndicator` and implicitly
 *   disables the button (see `disabled={disabled || loading}` below).
 * - `icon` is a FontAwesome5 icon name rendered before/after the title based
 *   on `iconPosition`; omitted entirely when not provided.
 * - `style`/`textStyle` let callers override the base container/text styles.
 */
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  // Added to support icons
  icon?: string;
  iconPosition?: 'left' | 'right';
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

/**
 * Themed button with primary/secondary/danger variants, an optional loading
 * spinner, and an optional left/right FontAwesome5 icon. Used anywhere the
 * app needs a standard call-to-action control instead of a bare
 * TouchableOpacity.
 */
export const Button = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}: ButtonProps) => {
  const { colors } = useAppTheme();

  // Disabled state always wins and shows a neutral border color regardless
  // of variant, so a disabled danger/primary button doesn't still look
  // actionable.
  const getBackgroundColor = () => {
    if (disabled) return colors.border;
    switch (variant) {
      case 'secondary': return colors.border; // Soft fallback
      case 'danger': return colors.danger;
      case 'primary':
      default: return colors.primary;
    }
  };

  // Secondary buttons use the theme's regular text color (since their
  // background is a light/neutral border color); primary and danger
  // variants always use white text for contrast against a saturated fill.
  const getTextColor = () => {
    if (variant === 'secondary') return colors.text;
    return '#FFF';
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        { backgroundColor: getBackgroundColor() },
        style // Correctly positioned at the end to override base styles
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={getTextColor()} />
      ) : (
        <>
          {icon && iconPosition === 'left' && (
            <FontAwesome5 
              name={icon} 
              size={18} 
              color={getTextColor()} 
              style={[styles.icon, { marginRight: title ? 8 : 0 }]} 
            />
          )}
          {title ? (
            <Text style={[
              styles.text, 
              { color: getTextColor() },
              textStyle
            ]}>
              {title}
            </Text>
          ) : null}
          {icon && iconPosition === 'right' && (
            <FontAwesome5 
              name={icon} 
              size={18} 
              color={getTextColor()} 
              style={[styles.icon, { marginLeft: title ? 8 : 0 }]} 
            />
          )}
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  icon: {
    // Optional: add any base icon styles here
  },
});