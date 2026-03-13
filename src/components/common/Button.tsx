import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  ActivityIndicator, 
  StyleSheet, 
  ViewStyle, 
  TextStyle,
  StyleProp // Added to support array styles
} from 'react-native';
import { useAppTheme } from '../../theme/ThemeContext';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  // USE StyleProp: This tells TypeScript that users can pass an array of styles 
  // (e.g., style={[styles.base, styles.active]}) instead of just a single object.
  style?: StyleProp<ViewStyle>;
  textStyle?: StyleProp<TextStyle>;
}

export const Button = ({
  title,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  style,
  textStyle,
}: ButtonProps) => {
  const { colors, isDarkMode } = useAppTheme();
  
  const getBackgroundColor = () => {
    if (disabled) return isDarkMode ? '#333' : '#A0A0A0'; 
    switch (variant) {
      case 'secondary': return colors.border;
      case 'danger': return colors.danger;
      case 'primary': 
      default: return colors.primary;
    }
  };

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
        <Text style={[
          styles.text, 
          { color: getTextColor() },
          textStyle
        ]}>
          {title}
        </Text>
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
});