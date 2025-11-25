import React from 'react';
import { Text, TextStyle, TextProps, View } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';

interface GradientTextProps extends TextProps {
  colors?: readonly [string, string, ...string[]];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  style?: TextStyle;
}

export const BRAND_GRADIENT_COLORS = ["#8B5CF6", "#6366F1"] as const;

export const GradientText = ({
  colors = BRAND_GRADIENT_COLORS,
  start = { x: 0, y: 0 },
  end = { x: 1, y: 1 },
  style,
  children,
  ...props
}: GradientTextProps) => {
  return (
    <MaskedView
      maskElement={
        <Text {...props} style={[style, { backgroundColor: 'transparent' }]}>
          {children}
        </Text>
      }
    >
      <LinearGradient
        colors={colors}
        start={start}
        end={end}
      >
        <Text {...props} style={[style, { opacity: 0 }]}>
          {children}
        </Text>
      </LinearGradient>
    </MaskedView>
  );
};

