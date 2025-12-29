import { useState, useEffect } from 'react';
import { Platform, Alert, Linking, PermissionsAndroid } from 'react-native';
import * as Audio from 'expo-audio';

export interface VoicePermissionsStatus {
  microphone: boolean;
  isChecking: boolean;
  hasChecked: boolean;
}

export const useVoicePermissions = () => {
  const [status, setStatus] = useState<VoicePermissionsStatus>({
    microphone: false,
    isChecking: false,
    hasChecked: false,
  });

  // Check current permission status without requesting
  const checkPermissions = async (): Promise<boolean> => {
    try {
      setStatus(prev => ({ ...prev, isChecking: true }));
      
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO
        );
        setStatus({
          microphone: granted,
          isChecking: false,
          hasChecked: true,
        });
        return granted;
      } else {
        // iOS - check via expo-av
        const { granted } = await Audio.getPermissionsAsync();
        setStatus({
          microphone: granted,
          isChecking: false,
          hasChecked: true,
        });
        return granted;
      }
    } catch (error) {
      console.error('[useVoicePermissions] Error checking permissions:', error);
      setStatus(prev => ({ ...prev, isChecking: false, hasChecked: true }));
      return false;
    }
  };

  // Request microphone permission with user-friendly UI
  const requestPermissions = async (): Promise<boolean> => {
    try {
      setStatus(prev => ({ ...prev, isChecking: true }));
      
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Access Required',
            message: 'VibeChat needs microphone access to enable Vibe Calls with your friends.',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Not Now',
            buttonPositive: 'Allow',
          }
        );
        
        const isGranted = granted === PermissionsAndroid.RESULTS.GRANTED;
        setStatus({
          microphone: isGranted,
          isChecking: false,
          hasChecked: true,
        });
        
        return isGranted;
      } else {
        // iOS
        const { granted } = await Audio.requestPermissionsAsync();
        setStatus({
          microphone: granted,
          isChecking: false,
          hasChecked: true,
        });
        
        return granted;
      }
    } catch (error) {
      console.error('[useVoicePermissions] Error requesting permissions:', error);
      setStatus(prev => ({ ...prev, isChecking: false, hasChecked: true }));
      return false;
    }
  };

  // Request with fallback to settings if denied
  const requestWithSettingsFallback = async (): Promise<boolean> => {
    const granted = await requestPermissions();
    
    if (!granted && status.hasChecked) {
      // Permission was denied, offer to open settings
      Alert.alert(
        'Microphone Permission Required',
        'VibeChat needs microphone access to enable voice calls. Please enable it in your device settings.',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Open Settings',
            onPress: () => {
              if (Platform.OS === 'ios') {
                Linking.openURL('app-settings:');
              } else {
                Linking.openSettings();
              }
            },
          },
        ]
      );
      return false;
    }
    
    return granted;
  };

  // Auto-check on mount
  useEffect(() => {
    checkPermissions();
  }, []);

  return {
    status,
    checkPermissions,
    requestPermissions,
    requestWithSettingsFallback,
  };
};

