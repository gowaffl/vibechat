import React, { useState, useCallback } from "react";
import { View, Text, Pressable } from "react-native";
import * as Haptics from "expo-haptics";

interface TruncatedTextProps {
  children: React.ReactNode;
  maxLines?: number;
  style?: any;
  expandButtonColor?: string;
  /** LOW-21: Skip truncation for critical messages like safety/crisis responses */
  bypassTruncation?: boolean;
}

/**
 * TruncatedText - Truncates long text content with a "See more" button
 * Displays first N lines, then shows expand/collapse button
 */
export const TruncatedText: React.FC<TruncatedTextProps> = ({
  children,
  maxLines = 25,
  style,
  expandButtonColor = "#007AFF",
  bypassTruncation = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [shouldShowButton, setShouldShowButton] = useState(false);
  const [fullHeight, setFullHeight] = useState(0);
  const [truncatedHeight, setTruncatedHeight] = useState(0);

  const onFullLayout = useCallback(
    (event: any) => {
      if (fullHeight === 0) {
        setFullHeight(event.nativeEvent.layout.height);
      }
    },
    [fullHeight]
  );

  const onTruncatedLayout = useCallback(
    (event: any) => {
      if (truncatedHeight === 0) {
        setTruncatedHeight(event.nativeEvent.layout.height);
      }
    },
    [truncatedHeight]
  );

  // Check if we need to show the button
  React.useEffect(() => {
    if (fullHeight > 0 && truncatedHeight > 0) {
      // Show button if full height is significantly larger than truncated
      setShouldShowButton(fullHeight > truncatedHeight * 1.15);
    }
  }, [fullHeight, truncatedHeight]);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  // LOW-21: If bypass is enabled, render children without any truncation logic
  if (bypassTruncation) {
    return <View>{children}</View>;
  }

  return (
    <View>
      {/* Hidden full content to measure height */}
      {fullHeight === 0 && (
        <View
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: "100%",
          }}
          onLayout={onFullLayout}
        >
          {children}
        </View>
      )}

      {/* Hidden truncated content to measure height */}
      {truncatedHeight === 0 && (
        <View
          style={{
            position: "absolute",
            opacity: 0,
            pointerEvents: "none",
            width: "100%",
            overflow: "hidden",
            maxHeight: maxLines * 22, // Approximate line height
          }}
          onLayout={onTruncatedLayout}
        >
          {children}
        </View>
      )}

      {/* Visible content */}
      <View
        style={
          !isExpanded && shouldShowButton
            ? {
                maxHeight: maxLines * 22, // Approximate line height
                overflow: "hidden",
              }
            : undefined
        }
      >
        {children}
      </View>

      {/* Expand/Collapse button */}
      {shouldShowButton && (
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => ({
            marginTop: 8,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Text
            style={{
              color: expandButtonColor,
              fontSize: 14,
              fontWeight: "600",
            }}
          >
            {isExpanded ? "See less" : "See more"}
          </Text>
        </Pressable>
      )}
    </View>
  );
};

