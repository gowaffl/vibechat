/**
 * LinkPreviewCard Component
 * Beautiful iMessage-style link preview cards
 */

import React from "react";
import { View, Text, Image, Pressable, Linking } from "react-native";
import { ExternalLink } from "lucide-react-native";
import type { LinkPreview } from "@/shared/contracts";

interface LinkPreviewCardProps {
  linkPreview: LinkPreview;
  isCurrentUser: boolean;
  isAI: boolean;
}

export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  linkPreview,
  isCurrentUser,
  isAI,
}) => {
  const handlePress = () => {
    if (linkPreview.url) {
      Linking.openURL(linkPreview.url);
    }
  };

  const borderColor = isCurrentUser
    ? "#007AFF"
    : isAI
    ? "#34C759"
    : "rgba(255, 255, 255, 0.2)";

  return (
    <Pressable
      onPress={handlePress}
      style={{
        marginTop: 8,
        borderRadius: 12,
        overflow: "hidden",
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderWidth: 1,
        borderColor: borderColor,
      }}
    >
      {/* Link Preview Image */}
      {linkPreview.image && (
        <Image
          source={{ uri: linkPreview.image }}
          style={{
            width: "100%",
            height: 180,
            backgroundColor: "rgba(255, 255, 255, 0.1)",
          }}
          resizeMode="cover"
        />
      )}

      {/* Link Preview Content */}
      <View
        style={{
          padding: 12,
        }}
      >
        {/* Site Name with Favicon */}
        {(linkPreview.siteName || linkPreview.favicon) && (
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            {linkPreview.favicon && (
              <Image
                source={{ uri: linkPreview.favicon }}
                style={{
                  width: 16,
                  height: 16,
                  borderRadius: 2,
                  marginRight: 6,
                }}
                resizeMode="contain"
              />
            )}
            {linkPreview.siteName && (
              <Text
                style={{
                  fontSize: 12,
                  color: "#8E8E93",
                  fontWeight: "600",
                  textTransform: "uppercase",
                }}
                numberOfLines={1}
              >
                {linkPreview.siteName}
              </Text>
            )}
          </View>
        )}

        {/* Title */}
        {linkPreview.title && (
          <Text
            style={{
              fontSize: 16,
              fontWeight: "600",
              color: "#FFFFFF",
              marginBottom: 4,
            }}
            numberOfLines={2}
          >
            {linkPreview.title}
          </Text>
        )}

        {/* Description */}
        {linkPreview.description && (
          <Text
            style={{
              fontSize: 14,
              color: "#8E8E93",
              lineHeight: 18,
              marginBottom: 8,
            }}
            numberOfLines={3}
          >
            {linkPreview.description}
          </Text>
        )}

        {/* URL with External Link Icon */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
          }}
        >
          <ExternalLink size={12} color="#8E8E93" style={{ marginRight: 4 }} />
          <Text
            style={{
              fontSize: 12,
              color: "#8E8E93",
              flex: 1,
            }}
            numberOfLines={1}
          >
            {linkPreview.url.replace(/^https?:\/\//i, "")}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};
