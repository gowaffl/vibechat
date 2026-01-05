import React from "react";
import { View, Pressable, StyleSheet, Platform } from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { useTheme } from "@/contexts/ThemeContext";
import { useCreatePersonalConversation } from "@/hooks/usePersonalChats";
import type { RootStackScreenProps } from "@/navigation/types";

const FAB_SIZE = 60;

export const PersonalChatFAB: React.FC = () => {
  const { colors, isDark } = useTheme();
  const navigation = useNavigation<RootStackScreenProps<"ChatList">["navigation"]>();
  const createConversation = useCreatePersonalConversation();

  const handlePress = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    try {
      // Create new conversation and navigate to it
      const newConversation = await createConversation.mutateAsync({});
      navigation.navigate("PersonalChat", { conversationId: newConversation.conversation.id });
    } catch (error) {
      console.error("[PersonalChatFAB] Error creating conversation:", error);
      // Still navigate to PersonalChat without conversationId to allow user to start fresh
      navigation.navigate("PersonalChat", { conversationId: "" });
    }
  };

  return (
    <View
      style={[
        {
          position: "absolute",
          right: 11,
          bottom: Platform.OS === "ios" ? 110 : 90,
          width: FAB_SIZE,
          height: FAB_SIZE,
          borderRadius: FAB_SIZE / 2,
          zIndex: 1000,
          shadowColor: isDark ? "#4FC3F7" : "#0061FF",
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: isDark ? 0.4 : 0.6,
          shadowRadius: isDark ? 12 : 16,
          elevation: 8,
          borderWidth: 1,
          borderColor: isDark ? "rgba(79, 195, 247, 0.3)" : "rgba(0, 97, 255, 0.2)",
          backgroundColor: "transparent",
        },
      ]}
    >
      <View style={{ flex: 1, overflow: "hidden", borderRadius: FAB_SIZE / 2 }}>
        <BlurView intensity={90} tint={colors.blurTint} style={{ flex: 1 }}>
          <LinearGradient
            colors={
              isDark
                ? ["rgba(40, 40, 50, 0.95)", "rgba(20, 20, 30, 0.98)"]
                : [colors.backgroundSecondary, colors.background]
            }
            style={{ flex: 1 }}
          >
            <Pressable
              onPress={handlePress}
              style={[
                StyleSheet.absoluteFill,
                { alignItems: "center", justifyContent: "center" },
              ]}
            >
              <View
                style={{
                  width: FAB_SIZE,
                  height: FAB_SIZE,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Image
                  source={require("../../../assets/vibechat icon main.png")}
                  style={{
                    width: FAB_SIZE * 0.7,
                    height: FAB_SIZE * 0.7,
                    borderRadius: (FAB_SIZE * 0.7) / 2,
                  }}
                  contentFit="cover"
                />
                <View
                  style={{
                    position: "absolute",
                    top: 10,
                    right: 10,
                    backgroundColor: "#0061FF",
                    borderRadius: 8,
                    width: 16,
                    height: 16,
                    alignItems: "center",
                    justifyContent: "center",
                    borderWidth: 1.5,
                    borderColor: "#000000",
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.3,
                    shadowRadius: 2,
                    elevation: 4,
                  }}
                >
                  <Plus size={10} color="#FFFFFF" strokeWidth={4} />
                </View>
              </View>
            </Pressable>
          </LinearGradient>
        </BlurView>
      </View>
    </View>
  );
};
