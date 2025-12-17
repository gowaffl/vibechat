import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { 
  ThemeMode, 
  ColorPalette, 
  darkColors, 
  lightColors, 
  navThemeDark, 
  navThemeLight 
} from '@/constants/theme';
import { useUser } from '@/contexts/UserContext';
import { api } from '@/lib/api';

const THEME_STORAGE_KEY = 'vibechat_theme_preference';

type ThemeContextType = {
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => Promise<void>;
  isDark: boolean;
  colors: ColorPalette;
  navTheme: typeof navThemeDark | typeof navThemeLight;
};

const ThemeContext = createContext<ThemeContextType>({
  themeMode: 'system',
  setThemeMode: async () => {},
  isDark: true,
  colors: darkColors,
  navTheme: navThemeDark,
});

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const systemColorScheme = useColorScheme();
  const { user, isAuthenticated } = useUser();
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isReady, setIsReady] = useState(false);

  // Initialize theme from storage or user preference
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        // 1. Try to get from AsyncStorage first (faster)
        const storedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedTheme && ['light', 'dark', 'system'].includes(storedTheme)) {
          setThemeModeState(storedTheme as ThemeMode);
        }
        
        // 2. If user is authenticated, check their profile preference
        // This will override local storage if they logged in on a new device
        if (isAuthenticated && user?.themePreference) {
          if (user.themePreference !== storedTheme) {
            setThemeModeState(user.themePreference as ThemeMode);
            await AsyncStorage.setItem(THEME_STORAGE_KEY, user.themePreference);
          }
        }
      } catch (error) {
        console.error('Failed to load theme preference:', error);
      } finally {
        setIsReady(true);
      }
    };

    loadThemePreference();
  }, [isAuthenticated, user?.themePreference]);

  // Handle theme mode change
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      // Update state
      setThemeModeState(mode);
      
      // Persist to local storage
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
      
      // Update user profile if authenticated
      if (isAuthenticated && user?.id) {
        await api.patch(`/api/users/${user.id}`, { themePreference: mode });
      }
    } catch (error) {
      console.error('Failed to set theme mode:', error);
    }
  };

  // Determine actual theme based on mode and system setting
  const isDark = 
    themeMode === 'dark' || 
    (themeMode === 'system' && systemColorScheme === 'dark');

  const colors = isDark ? darkColors : lightColors;
  const navTheme = isDark ? navThemeDark : navThemeLight;

  if (!isReady) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider value={{
      themeMode,
      setThemeMode,
      isDark,
      colors,
      navTheme,
    }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

