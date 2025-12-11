import React, { useEffect } from 'react';
import { Text, View, StyleSheet, TextStyle, StyleProp, LayoutChangeEvent } from 'react-native';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { 
  useAnimatedStyle, 
  useSharedValue, 
  withRepeat, 
  withTiming, 
  Easing 
} from 'react-native-reanimated';

interface ShimmeringTextProps {
  text: string;
  style?: StyleProp<TextStyle>;
  shimmerColor?: string;
  duration?: number;
}

export const ShimmeringText: React.FC<ShimmeringTextProps> = ({ 
  text, 
  style, 
  shimmerColor = 'rgba(255, 255, 255, 0.6)',
  duration = 2000 
}) => {
  const translateX = useSharedValue(-100);
  const [layoutWidth, setLayoutWidth] = React.useState(0);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(100, { 
        duration, 
        easing: Easing.linear 
      }), 
      -1, // Infinite
      false // Do not reverse
    );
  }, [duration]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateX: `${translateX.value}%` }],
    };
  });

  // Extract color from style to use as base background
  const flattenedStyle = StyleSheet.flatten(style) || {};
  const textColor = flattenedStyle.color || '#000';
  
  // Remove background color from text style as it should be handled by the parent container
  // to avoid masking issues
  const { backgroundColor, ...textStyle } = flattenedStyle;

  return (
    <MaskedView
      maskElement={
        <Text style={[textStyle, { backgroundColor: 'transparent' }]}>
          {text}
        </Text>
      }
    >
      {/* Base Text Color Layer */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: textColor }]} />
      
      {/* Shimmer Layer */}
      <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
        <LinearGradient
          colors={['transparent', shimmerColor, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      
      {/* Invisible text to maintain layout size */}
      <Text style={[textStyle, { opacity: 0 }]}>{text}</Text>
    </MaskedView>
  );
};
