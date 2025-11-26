import React from 'react';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { View, ViewStyle } from 'react-native';

interface GradientIconProps {
  icon: React.ReactNode;
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: ViewStyle;
}

export const BRAND_GRADIENT_COLORS = ["#4FC3F7", "#00A8E8"] as const;

export const GradientIcon = ({
  icon,
  colors = BRAND_GRADIENT_COLORS,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
}: GradientIconProps) => {
  return (
    <MaskedView
      style={[{ width: 24, height: 24 }, style]}
      maskElement={<View style={{ backgroundColor: 'transparent', alignItems: 'center', justifyContent: 'center' }}>{icon}</View>}
    >
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
        style={{ flex: 1 }}
      />
    </MaskedView>
  );
};

