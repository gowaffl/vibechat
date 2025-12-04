import React, { useState } from "react";
import { View, Text } from "react-native";
import { Image } from "expo-image";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";

interface ProfileImageProps {
  imageUri?: string | null;
  isAI?: boolean;
  userName?: string;
  size?: number;
}

export const ProfileImage: React.FC<ProfileImageProps> = ({ 
  imageUri, 
  isAI = false, 
  userName, 
  size = 34 
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const fullImageUrl = getFullImageUrl(imageUri);
  const initials = getInitials(userName);
  const backgroundColor = getColorFromName(userName);
  
  // Calculate sizes based on prop
  const fontSize = Math.max(12, size * 0.4);
  const borderRadius = size / 2;

  // AI always uses the VibeChat icon
  if (isAI) {
    return (
      <View style={{ width: size, height: size, marginRight: 8 }}>
        <Image
          source={require("../../assets/vibechat icon main.png")}
          style={{ width: size, height: size, borderRadius: borderRadius }}
          contentFit="cover"
        />
      </View>
    );
  }

  return (
    <View style={{ width: size, height: size, marginRight: 8 }}>
      {fullImageUrl && !hasError ? (
        <View style={{ position: "relative", width: size, height: size }}>
          {/* Placeholder shown while loading */}
          {isLoading && (
            <View
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: size,
                height: size,
                borderRadius: borderRadius,
                backgroundColor: backgroundColor,
                alignItems: "center",
                justifyContent: "center",
                zIndex: 1,
              }}
            >
              <Text
                style={{
                  color: "#FFFFFF",
                  fontSize: fontSize,
                  fontWeight: "600",
                  textAlign: "center",
                }}
              >
                {initials}
              </Text>
            </View>
          )}
          {/* Actual image */}
          <Image
            source={{ uri: fullImageUrl }}
            style={{ width: size, height: size, borderRadius: borderRadius }}
            contentFit="cover"
            onLoadStart={() => setIsLoading(true)}
            onLoadEnd={() => setIsLoading(false)}
            onError={() => {
              setIsLoading(false);
              setHasError(true);
            }}
          />
        </View>
      ) : (
        // Fallback when no image or error - show initials
        <View
          style={{
            width: size,
            height: size,
            borderRadius: borderRadius,
            backgroundColor: backgroundColor,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Text
            style={{
              color: "#FFFFFF",
              fontSize: fontSize,
              fontWeight: "600",
              textAlign: "center",
            }}
          >
            {initials}
          </Text>
        </View>
      )}
    </View>
  );
};

