import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { StyleSheet, View, Text, Platform } from 'react-native';
import Animated, { 
  FadeInUp, 
  FadeOutUp, 
  useAnimatedStyle, 
  withSpring, 
  useSharedValue, 
  withTiming,
  runOnJS
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';

type ToastType = 'success' | 'error' | 'info';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
  title?: string;
}

interface ToastContextType {
  showToast: (options: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

interface ToastProps {
  id: string;
  message: string;
  title?: string;
  type: ToastType;
  onHide: (id: string) => void;
}

const Toast = ({ id, message, title, type, onHide }: ToastProps) => {
  const insets = useSafeAreaInsets();
  
  const getIcon = () => {
    switch (type) {
      case 'success': return 'checkmark-circle';
      case 'error': return 'alert-circle';
      case 'info': return 'information-circle';
    }
  };

  const getColors = () => {
    switch (type) {
      case 'success': return { bg: 'rgba(34, 197, 94, 0.9)', text: '#fff' };
      case 'error': return { bg: 'rgba(239, 68, 68, 0.9)', text: '#fff' };
      case 'info': return { bg: 'rgba(59, 130, 246, 0.9)', text: '#fff' };
    }
  };

  const colors = getColors();

  return (
    <Animated.View 
      entering={FadeInUp.springify().damping(15)} 
      exiting={FadeOutUp.duration(300)}
      style={[
        styles.toastContainer, 
        { top: insets.top + 10 },
      ]}
    >
      <BlurView intensity={Platform.OS === 'ios' ? 20 : 0} style={[styles.blurContainer, { backgroundColor: colors.bg }]}>
        <View style={styles.contentContainer}>
          <Ionicons name={getIcon()} size={24} color={colors.text} style={styles.icon} />
          <View style={styles.textContainer}>
            {title && <Text style={[styles.title, { color: colors.text }]}>{title}</Text>}
            <Text style={[styles.message, { color: colors.text }]}>{message}</Text>
          </View>
        </View>
      </BlurView>
    </Animated.View>
  );
};

export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<Array<ToastProps & { duration: number }>>([]);

  const showToast = useCallback(({ message, type = 'success', duration = 3000, title }: ToastOptions) => {
    const id = Math.random().toString(36).substring(7);
    const newToast = { id, message, type, duration, title };
    
    // Currently only showing one toast at a time for cleanliness, replacing the old one
    setToasts([newToast]);

    setTimeout(() => {
      setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));
    }, duration);
  }, []);

  const hideToast = useCallback((id: string) => {
    setToasts((currentToasts) => currentToasts.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <View style={styles.container} pointerEvents="box-none">
        {toasts.map((toast) => (
          <Toast 
            key={toast.id} 
            {...toast} 
            onHide={hideToast} 
          />
        ))}
      </View>
    </ToastContext.Provider>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    alignItems: 'center',
  },
  toastContainer: {
    width: '90%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  blurContainer: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  contentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontWeight: '600',
    fontSize: 16,
    marginBottom: 2,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
  },
});


