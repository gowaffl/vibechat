import React, { useEffect, useRef } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { Message, AIFriend } from "@shared/contracts";
import MessageText from "./MessageText";
import { ProfileImage } from "./ProfileImage";
import { X, ArrowDown } from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

interface ReplyPreviewModalProps {
  visible: boolean;
  message: { original: Message; reply: Message } | null;
  onClose: () => void;
  aiFriends: AIFriend[];
}

export const ReplyPreviewModal: React.FC<ReplyPreviewModalProps> = ({
  visible,
  message,
  onClose,
  aiFriends,
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

  const renderMessageContent = (msg: Message | undefined | null, isReply: boolean) => {
    if (!msg) return null;

    const displayName = msg.aiFriendId
      ? msg.aiFriend?.name ||
        aiFriends.find((f) => f.id === msg.aiFriendId)?.name ||
        "AI Friend"
      : msg.user?.name || "Unknown";

    const displayImage = msg.aiFriendId
      ? null // AI uses default icon inside ProfileImage
      : msg.user?.image;
    
    const isAIMessage = !!msg.aiFriendId;

    return (
      <View style={{ marginBottom: isReply ? 0 : 20 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 8,
            gap: 10,
          }}
        >
          <ProfileImage
            imageUri={displayImage}
            userName={displayName}
            isAI={isAIMessage}
            size={24}
          />
          <View>
            <Text style={{ color: "rgba(255, 255, 255, 0.9)", fontWeight: "600", fontSize: 14 }}>
              {displayName}
            </Text>
            <Text style={{ color: "rgba(255, 255, 255, 0.5)", fontSize: 11 }}>
              {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </Text>
          </View>
          <View style={{ 
            backgroundColor: isReply ? "rgba(0, 122, 255, 0.2)" : "rgba(255, 255, 255, 0.1)", 
            paddingHorizontal: 8, 
            paddingVertical: 2, 
            borderRadius: 4,
            marginLeft: "auto" 
          }}>
            <Text style={{ 
              color: isReply ? "#60A5FA" : "rgba(255, 255, 255, 0.6)", 
              fontSize: 10, 
              fontWeight: "600" 
            }}>
              {isReply ? "REPLY" : "ORIGINAL"}
            </Text>
          </View>
        </View>

        {/* Content */}
        <View style={{ 
          paddingLeft: 34, // Align with name (24px avatar + 10px gap)
        }}>
          <MessageText
            content={msg.content}
            mentions={msg.mentions}
            style={{
              color: "#FFFFFF",
              fontSize: 15,
              lineHeight: 22,
            }}
            isOwnMessage={false}
          />
          
          {msg.messageType === "image" && msg.imageUrl && (
            <View style={{ marginTop: 8 }}>
              <Text style={{ color: "rgba(255, 255, 255, 0.5)", fontStyle: "italic", fontSize: 13 }}>
                [Image attachment]
              </Text>
            </View>
          )}
        </View>
      </View>
    );
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
            backgroundColor: "rgba(30, 30, 30, 0.95)",
            borderRadius: 24,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.1)",
            overflow: "hidden",
            shadowColor: "#000",
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.5,
            shadowRadius: 30,
            elevation: 20,
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
            <Text style={{ color: "#FFFFFF", fontWeight: "600", fontSize: 16 }}>
              Thread Context
            </Text>
            
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

          {/* Thread Content */}
          <ScrollView
            style={{ maxHeight: 400 }}
            contentContainerStyle={{ padding: 20 }}
            keyboardShouldPersistTaps="always"
          >
            {message && (
              <>
                {/* Original Message */}
                {renderMessageContent(message.original, false)}

                {/* Connector Line */}
                <View style={{ 
                  marginLeft: 11, 
                  height: 20, 
                  borderLeftWidth: 2, 
                  borderLeftColor: "rgba(255, 255, 255, 0.1)",
                  marginTop: -20,
                  marginBottom: 0,
                }} />
                
                {/* Reply Arrow */}
                <View style={{ 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  marginBottom: 10,
                  marginLeft: 4
                }}>
                   <View style={{ 
                     width: 16, 
                     height: 16, 
                     borderRadius: 8, 
                     backgroundColor: "rgba(255, 255, 255, 0.1)",
                     alignItems: 'center',
                     justifyContent: 'center'
                   }}>
                     <ArrowDown size={10} color="rgba(255, 255, 255, 0.5)" />
                   </View>
                </View>

                {/* Reply Message */}
                {renderMessageContent(message.reply, true)}
              </>
            )}
          </ScrollView>
        </View>
      </BlurView>
    </Animated.View>
  );
};
