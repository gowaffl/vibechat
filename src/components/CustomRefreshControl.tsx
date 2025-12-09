import React from 'react';
import { View, Text, Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LuxeLogoLoader } from './LuxeLogoLoader';
import { GradientText } from './GradientText';

interface CustomRefreshControlProps {
  refreshing: boolean;
  message?: string;
  topOffset?: number;
}

export const CustomRefreshControl: React.FC<CustomRefreshControlProps> = ({ 
  refreshing,
  message = "Refreshing chats",
  topOffset
}) => {
  const insets = useSafeAreaInsets();
  
  if (!refreshing) return null;

  // Calculate position to be just below the header
  // Header has paddingTop: insets.top + 16 and paddingBottom: 16
  // Plus the search bar and title height (approximately 100-120px)
  const topPosition = topOffset ?? (insets.top + 140);

  return (
    <View
      style={{
        position: 'absolute',
        top: topPosition,
        left: 0,
        right: 0,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 150, // Higher than header's zIndex of 100
      }}
    >
      <View
        style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          borderRadius: 20,
          paddingVertical: 12,
          paddingHorizontal: 20,
          flexDirection: 'row',
          alignItems: 'center',
          shadowColor: '#4FC3F7',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.4,
          shadowRadius: 12,
          elevation: 10,
          borderWidth: 1,
          borderColor: 'rgba(79, 195, 247, 0.3)',
        }}
      >
        <LuxeLogoLoader size={24} />
        <GradientText
          style={{
            fontSize: 15,
            fontWeight: '600',
            marginLeft: 12,
          }}
        >
          {message}
        </GradientText>
      </View>
    </View>
  );
};

