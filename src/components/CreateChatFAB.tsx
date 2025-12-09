import React, { useState, useEffect } from "react";
import { 
  View, 
  Text, 
  Pressable, 
  TextInput, 
  StyleSheet, 
  Dimensions, 
  ActivityIndicator,
  Keyboard,
  Platform
} from "react-native";
import { Image } from "expo-image";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming, 
  interpolate, 
  Extrapolation,
  runOnJS
} from "react-native-reanimated";
import { X, Check, Plus } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useUser } from "@/contexts/UserContext";
import { api } from "@/lib/api";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { CreateChatResponse } from "@/shared/contracts";

const { width, height } = Dimensions.get("window");

// Constants
const FAB_SIZE = 60;
const EXPANDED_WIDTH = width - 32; // 16px margin on each side
const EXPANDED_HEIGHT = 400;

export const CreateChatFAB = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [chatName, setChatName] = useState("");
  const [chatBio, setChatBio] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const { user } = useUser();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  // Animation Values
  const expansion = useSharedValue(0); // 0 -> 1
  const keyboardHeight = useSharedValue(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => {
       // Store full keyboard height
       keyboardHeight.value = withTiming(e.endCoordinates.height, { duration: 300 });
    });
    const hideSub = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => {
       keyboardHeight.value = withTiming(0, { duration: 300 });
    });
    return () => { showSub.remove(); hideSub.remove(); }
  }, []);

  useEffect(() => {
    expansion.value = withSpring(isOpen ? 1 : 0, {
      damping: 18,
      stiffness: 200,
      mass: 0.8,
    });
  }, [isOpen]);

  const toggleOpen = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (isOpen) {
       Keyboard.dismiss();
    }
    setIsOpen(!isOpen);
  };

  const closeFAB = () => {
    Keyboard.dismiss();
    setIsOpen(false);
    // Reset fields after animation
    setTimeout(() => {
        setChatName("");
        setChatBio("");
    }, 300);
  };

  // Create Chat Mutation
  const createChatMutation = useMutation({
    mutationFn: (data: { name: string; bio: string | null; creatorId: string }) => 
      api.post<CreateChatResponse>("/api/chats", data),
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: ["user-chats"] });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      closeFAB();
      
      // Navigate to the new chat
      navigation.navigate("Chat", {
        chatId: newChat.id,
        chatName: newChat.name,
      });
    },
    onError: () => {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
  });

  const handleCreate = async () => {
    if (!chatName.trim()) return;
    
    setIsCreating(true);
    try {
      await createChatMutation.mutateAsync({
        name: chatName.trim(),
        bio: chatBio.trim() || null,
        creatorId: user!.id,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // Animated Styles
  const containerStyle = useAnimatedStyle(() => {
    return {
      width: interpolate(expansion.value, [0, 1], [FAB_SIZE, EXPANDED_WIDTH]),
      height: interpolate(expansion.value, [0, 1], [FAB_SIZE, EXPANDED_HEIGHT]),
      borderRadius: interpolate(expansion.value, [0, 0.2, 1], [FAB_SIZE / 2, FAB_SIZE / 1.5, 24]),
      right: interpolate(expansion.value, [0, 1], [11, 16]),
      // Calculate bottom position to center vertically in the space above keyboard
      // (Screen Height - Keyboard Height - Expanded Height) / 2 + Keyboard Height
      // Simplified: (Screen Height + Keyboard Height - Expanded Height) / 2
      bottom: interpolate(expansion.value, [0, 1], [
        Platform.OS === 'ios' ? 110 : 90, 
        (height + keyboardHeight.value - EXPANDED_HEIGHT) / 2
      ]), 
      transform: [
        { scale: interpolate(expansion.value, [0, 0.4, 0.7, 1], [1, 1.15, 0.9, 1]) }
      ]
    };
  });
  
  const contentOpacityStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expansion.value, [0.5, 1], [0, 1]),
      transform: [
        { scale: interpolate(expansion.value, [0.5, 1], [0.9, 1]) }
      ],
      pointerEvents: isOpen ? 'auto' : 'none',
    };
  });

  const iconStyle = useAnimatedStyle(() => {
    return {
      opacity: interpolate(expansion.value, [0, 0.2], [1, 0]),
      transform: [
        { scale: interpolate(expansion.value, [0, 0.2], [1, 0.5]) }
      ]
    };
  });

  return (
    <>
      {/* Backdrop for closing */}
      {isOpen && (
        <Pressable 
          style={StyleSheet.absoluteFill} 
          onPress={closeFAB}
        >
          <Animated.View 
            style={[{ 
              flex: 1,
            }, { opacity: expansion }]} 
          >
              <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={[StyleSheet.absoluteFill, { backgroundColor: "rgba(0,0,0,0.4)" }]} />
          </Animated.View>
        </Pressable>
      )}

      <Animated.View
        style={[
          {
            position: "absolute",
            overflow: "hidden",
            zIndex: 1000,
            shadowColor: "#4FC3F7",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 8,
          },
          containerStyle
        ]}
      >
        <BlurView
          intensity={90}
          tint="dark"
          style={{ flex: 1 }}
        >
           <LinearGradient
              colors={["rgba(40, 40, 50, 0.95)", "rgba(20, 20, 30, 0.98)"]}
              style={{ flex: 1 }}
           >
              {/* Closed State: Icon */}
              <Pressable
                onPress={toggleOpen}
                style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}
                pointerEvents={isOpen ? 'none' : 'auto'}
              >
                 <Animated.View style={iconStyle}>
                    <View style={{ width: FAB_SIZE, height: FAB_SIZE, alignItems: 'center', justifyContent: 'center' }}>
                        <Image
                            source={require("../../assets/vibechat icon main.png")}
                            style={{ width: FAB_SIZE * 0.7, height: FAB_SIZE * 0.7, borderRadius: (FAB_SIZE * 0.7) / 2 }}
                            contentFit="cover"
                        />
                        <View style={{
                            position: 'absolute',
                            top: 10,
                            right: 10,
                            backgroundColor: '#0061FF',
                            borderRadius: 8,
                            width: 16,
                            height: 16,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1.5,
                            borderColor: '#000000',
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.3,
                            shadowRadius: 2,
                            elevation: 4
                        }}>
                            <Plus size={10} color="#FFFFFF" strokeWidth={4} />
                        </View>
                    </View>
                 </Animated.View>
              </Pressable>

              {/* Open State: Form */}
              <Animated.View style={[StyleSheet.absoluteFill, { padding: 24 }, contentOpacityStyle]}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                      <Text style={{ fontSize: 24, fontWeight: "700", color: "#FFFFFF" }}>Create Chat</Text>
                      <Pressable onPress={closeFAB} style={{ padding: 4 }}>
                          <X size={24} color="rgba(255, 255, 255, 0.5)" />
                      </Pressable>
                  </View>

                  <View style={{ gap: 16 }}>
                      <View>
                          <Text style={{ color: "#FFF", marginBottom: 8, fontWeight: "600" }}>Name</Text>
                          <TextInput
                              value={chatName}
                              onChangeText={setChatName}
                              placeholder="Chat Name"
                              placeholderTextColor="rgba(255, 255, 255, 0.3)"
                              style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                                  borderRadius: 12,
                                  padding: 16,
                                  color: "#FFFFFF",
                                  fontSize: 16
                              }}
                          />
                      </View>

                      <View>
                          <Text style={{ color: "#FFF", marginBottom: 8, fontWeight: "600" }}>Description</Text>
                          <TextInput
                              value={chatBio}
                              onChangeText={setChatBio}
                              placeholder="What is this chat about?"
                              placeholderTextColor="rgba(255, 255, 255, 0.3)"
                              multiline
                              numberOfLines={3}
                              style={{
                                  backgroundColor: "rgba(255, 255, 255, 0.1)",
                                  borderRadius: 12,
                                  padding: 16,
                                  color: "#FFFFFF",
                                  fontSize: 16,
                                  height: 100,
                                  textAlignVertical: 'top'
                              }}
                          />
                      </View>

                      <Pressable
                        onPress={handleCreate}
                        disabled={!chatName.trim() || isCreating}
                        style={({ pressed }) => ({
                            marginTop: 16,
                            opacity: pressed || !chatName.trim() ? 0.8 : 1
                        })}
                      >
                          <LinearGradient
                            colors={["#0061FF", "#00C6FF"]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={{
                                borderRadius: 12,
                                paddingVertical: 16,
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexDirection: 'row',
                                gap: 8
                            }}
                          >
                              {isCreating ? (
                                  <ActivityIndicator color="#FFF" />
                              ) : (
                                  <>
                                    <Text style={{ color: "#FFF", fontWeight: "700", fontSize: 16 }}>Create</Text>
                                    <Check size={20} color="#FFF" />
                                  </>
                              )}
                          </LinearGradient>
                      </Pressable>
                  </View>
              </Animated.View>
           </LinearGradient>
        </BlurView>
      </Animated.View>
    </>
  );
};
