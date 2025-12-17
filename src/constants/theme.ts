export type ThemeMode = 'light' | 'dark' | 'system';

export type ColorPalette = {
  // Backgrounds
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceSecondary: string;
  
  // Text
  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverted: string;
  
  // Borders
  border: string;
  borderSecondary: string;
  
  // Glass Effects
  glassBackground: string;
  glassBackgroundSecondary: string;
  glassBorder: string;
  glassShadow: string;
  blurTint: 'light' | 'dark' | 'default';
  
  // Gradients
  gradientStart: string;
  gradientEnd: string;
  cardGradientStart: string;
  cardGradientEnd: string;
  tabBarGradientStart: string;
  tabBarGradientEnd: string;
  
  // Chat Background Gradient (Array of 3 colors)
  chatBackgroundGradient: [string, string, string];

  // UI Elements
  tabBarBackground: string;
  tabBarBorder: string;
  inputBackground: string;
  inputPlaceholder: string;
  
  // Toggle Switch
  switchTrackOff: string;
  switchTrackOn: string;
  switchThumb: string;
  
  // Status/Accents (These might be same across themes but good to have in palette)
  primary: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  
  // Overlay
  overlay: string;
};

export const darkColors: ColorPalette = {
  // Backgrounds
  background: '#000000',
  backgroundSecondary: '#0A0A0F',
  surface: '#1A1A1F',
  surfaceSecondary: '#111115',
  
  // Text
  text: '#FFFFFF',
  textSecondary: '#999999',
  textTertiary: '#666666',
  textInverted: '#000000',
  
  // Borders
  border: '#333333',
  borderSecondary: '#444444',
  
  // Glass Effects
  glassBackground: 'rgba(255, 255, 255, 0.08)',
  glassBackgroundSecondary: 'rgba(10, 10, 15, 0.9)',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  glassShadow: '#000000',
  blurTint: 'dark',
  
  // Gradients
  gradientStart: '#111111',
  gradientEnd: '#000000',
  cardGradientStart: 'rgba(255, 255, 255, 0.08)',
  cardGradientEnd: 'rgba(255, 255, 255, 0.02)',
  tabBarGradientStart: 'rgba(40, 40, 50, 0.5)',
  tabBarGradientEnd: 'rgba(10, 10, 15, 0.8)',
  
  // Chat Background Gradient
  chatBackgroundGradient: ['#0A0A0A', '#1A1A2E', '#16213E'],

  // UI Elements
  tabBarBackground: '#0A0A0F',
  tabBarBorder: 'rgba(255, 255, 255, 0.1)',
  inputBackground: 'rgba(255, 255, 255, 0.1)',
  inputPlaceholder: '#666666',
  
  // Toggle Switch
  switchTrackOff: '#3A3A3C',
  switchTrackOn: '#34C759',
  switchThumb: '#FFFFFF',
  
  // Status/Accents
  primary: '#4FC3F7',
  success: '#34C759',
  warning: '#FFCC00',
  error: '#FF3B30',
  info: '#007AFF',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.8)'
};

export const lightColors: ColorPalette = {
  // Backgrounds
  background: '#FAFAF9', // Warm off-white
  backgroundSecondary: '#F3F4F6',
  surface: '#FFFFFF',
  surfaceSecondary: '#F8FAFC',
  
  // Text
  text: '#1A1A1A', // Charcoal
  textSecondary: '#64748B', // Slate gray
  textTertiary: '#94A3B8',
  textInverted: '#FFFFFF',
  
  // Borders
  border: '#E2E8F0',
  borderSecondary: '#CBD5E1',
  
  // Glass Effects
  glassBackground: 'rgba(255, 255, 255, 0.6)',
  glassBackgroundSecondary: 'rgba(255, 255, 255, 0.85)',
  glassBorder: 'rgba(255, 255, 255, 0.5)',
  glassShadow: 'rgba(0, 0, 0, 0.1)',
  blurTint: 'light',
  
  // Gradients
  gradientStart: '#FFFFFF',
  gradientEnd: '#F1F5F9',
  cardGradientStart: 'rgba(255, 255, 255, 0.8)',
  cardGradientEnd: 'rgba(255, 255, 255, 0.4)',
  tabBarGradientStart: 'rgba(255, 255, 255, 0.8)',
  tabBarGradientEnd: 'rgba(248, 250, 252, 0.9)',
  
  // Chat Background Gradient - Luxe Light
  chatBackgroundGradient: ['#FFFFFF', '#F3F4F6', '#E2E8F0'],

  // UI Elements
  tabBarBackground: '#FFFFFF',
  tabBarBorder: 'rgba(203, 213, 225, 0.4)',
  inputBackground: 'rgba(0, 0, 0, 0.05)',
  inputPlaceholder: '#94A3B8',
  
  // Toggle Switch
  switchTrackOff: '#E5E5EA',
  switchTrackOn: '#34C759',
  switchThumb: '#FFFFFF',
  
  // Status/Accents (Kept vibrant for brand identity, adjusted slightly for contrast if needed)
  primary: '#4FC3F7', // Brand teal/cyan (same as dark mode)
  success: '#34C759',
  warning: '#FF9500', // Darker orange/yellow
  error: '#FF3B30',
  info: '#4FC3F7',
  
  // Overlay
  overlay: 'rgba(0, 0, 0, 0.4)'
};

// Navigation themes
export const navThemeDark = {
  dark: true,
  colors: {
    primary: '#4FC3F7',
    background: '#000000',
    card: '#0A0A0F',
    text: '#FFFFFF',
    border: '#333333',
    notification: '#FF3B30',
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
};

export const navThemeLight = {
  dark: false,
  colors: {
    primary: '#4FC3F7',
    background: '#FAFAF9',
    card: '#FFFFFF',
    text: '#1A1A1A',
    border: '#E2E8F0',
    notification: '#FF3B30',
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400' as const,
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500' as const,
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700' as const,
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '900' as const,
    },
  },
};
