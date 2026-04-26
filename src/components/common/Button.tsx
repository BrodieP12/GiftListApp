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
  
  const getBackgroundColor = () => {
    if (disabled) return colors.border; 
    switch (variant) {
      case 'secondary': return colors.border; // Soft fallback
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