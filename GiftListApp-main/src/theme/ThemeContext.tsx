import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

export interface ThemeColors {
  background: string;
  card: string;
  text: string;
  textDim: string;
  primary: string;
  danger: string;
  border: string;
}

const lightColors: ThemeColors = {
  background: '#F2F2F7',
  card: '#FFFFFF',
  text: '#333333',
  textDim: '#888888',
  primary: '#007AFF', // Standard iOS Blue
  danger: '#FF3B30',
  border: '#E5E5EA',
};

const darkColors: ThemeColors = {
  background: '#000000',
  card: '#1C1C1E',
  text: '#FFFFFF',
  textDim: '#EBEBF5',
  primary: '#0A84FF',
  danger: '#FF453A',
  border: '#38383A',
};

interface ThemeContextProps {
  isDark: boolean;
  colors: ThemeColors;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextProps>({
  isDark: false,
  colors: lightColors,
  toggleTheme: () => {},
});

/**
 * Provides application-wide colors and handles light/dark mode transitions based on system preferences.
 */
export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');

  // Listen for system theme changes and update automatically
  useEffect(() => {
    setIsDark(systemColorScheme === 'dark');
  }, [systemColorScheme]);

  const toggleTheme = () => setIsDark(prev => !prev);
  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ isDark, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

/**
 * Hook to access the current theme colors and toggle functions.
 */
export const useAppTheme = () => useContext(ThemeContext);
