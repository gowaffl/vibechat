import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { Message } from "@shared/contracts";
import MessageText from "./MessageText";
import { ProfileImage } from "./ProfileImage";
import { X } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

interface ReplyPreviewModalProps {
  visible: boolean;
  message: Message | null;
  onClose: () => void;
}

export const ReplyPreviewModal: React.FC<ReplyPreviewModalProps> = ({
  visible,
  message,
  onClose,
}) => {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible && !message) return null;

  const handleClose = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFill,
        { 
          opacity: fadeAnim,
        }
      ]}
      pointerEvents={visible ? "auto" : "none"}
    >
      <BlurView
        intensity={40}
        tint="dark"
        style={{ flex: 1, justifyContent: "center", alignItems: "center", padding: 20 }}
      >
        {/* Backdrop - Dismiss on tap */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleClose}
        />

        {/* Modal Content */}
        <View
          style={{
            width: "100%",
            maxWidth: 400,
            backgroundColor: "rgba(30, 30, 30, 0.9)",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          {/* Header */}
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ProfileImage
                imageUri={message?.user?.image}
                userName={message?.user?.name || "Unknown"}
                size={32}
              />
              <View>
                <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>
                  {message?.user?.name || "Unknown"}
                </Text>
                <Text style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 12 }}>
                  {message ? new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ""}
                </Text>
              </View>
            </View>
            
            <Pressable
              onPress={handleClose}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <X size={16} color="#FFFFFF" />
            </Pressable>
          </View>

          {/* Message Content */}
          <ScrollView
            style={{ maxHeight: 300 }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="always"
          >
            {message && (
              <>
                <MessageText
                  content={message.content}
                  mentions={message.mentions}
                  style={{
                    color: "#FFFFFF",
                    fontSize: 17,
                    lineHeight: 24,
                  }}
                  isOwnMessage={false}
                />
                
                {message.messageType === "image" && message.imageUrl && (
                  <View style={{ marginTop: 10 }}>
                    <Text style={{ color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic" }}>
                      [Image attachment]
                    </Text>
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Animated.View>
  );
};
