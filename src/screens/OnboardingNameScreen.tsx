import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Animated,
  Easing,
  Keyboard,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { RootStackScreenProps } from "@/navigation/types";

const OnboardingNameScreen = () => {
  const navigation = useNavigation<RootStackScreenProps<"OnboardingName">["navigation"]>();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      keyboardDidHideListener.remove();
      keyboardDidShowListener.remove();
    };
  }, []);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.delay(1500),
      ])
    ).start();
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 400],
  });

  const handleContinue = () => {
    if (!name.trim()) {
      alert("Please enter your name");
      return;
    }

    Haptics.selectionAsync();
    navigation.navigate("OnboardingPhoto", {
      name: name.trim(),
      bio: bio.trim() || undefined,
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Animated Gradient Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
        <LinearGradient
          colors={[
            "rgba(138, 43, 226, 0.05)",
            "rgba(0, 122, 255, 0.03)",
            "transparent",
            "rgba(52, 199, 89, 0.03)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Animated.View
            className="flex-1 px-6 pt-8"
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              paddingBottom: isKeyboardVisible ? 20 : 32,
              justifyContent: "center",
            }}
          >
            {/* Header */}
            <View className="items-center mb-8">
              <View
                style={{
                  width: 180,
                  height: 180,
                  borderRadius: 90,
                  marginBottom: 32,
                  overflow: "hidden",
                  borderWidth: 1,
                  borderColor: "rgba(255, 255, 255, 0.1)",
                }}
              >
                <Image
                  source={require("../../assets/image-1762790557.jpeg")}
                  style={{ width: 180, height: 180 }}
                  contentFit="cover"
                />
              </View>
              <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFFFFF", marginBottom: 16, textAlign: "center" }}>
                The Ultimate Group Chat
              </Text>
              <Text style={{ fontSize: 17, color: "rgba(255, 255, 255, 0.8)", textAlign: "center", paddingHorizontal: 16, lineHeight: 24 }}>
                Work or play, VibeChat adapts to you. Create custom AI agents that actually help (or roast), summon powerful tools with slash commands, and keep chaos under control with smart, dynamic threads. It’s your group, supercharged.
              </Text>
            </View>

            {/* Name Input */}
            <View style={{ marginBottom: 24 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF", marginBottom: 8 }}>
                Name *
              </Text>
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView intensity={Platform.OS === "ios" ? 40 : 80} tint="dark" style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)" }}>
                  <LinearGradient colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                      placeholder="Enter your name"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      style={{ paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#FFFFFF" }}
                      autoCapitalize="words"
                      maxLength={50}
                      returnKeyType="next"
                    />
                  </LinearGradient>
                </BlurView>
              </View>
            </View>

            {/* Bio Input */}
            <View style={{ marginBottom: 32 }}>
              <Text style={{ fontSize: 14, fontWeight: "600", color: "#FFFFFF", marginBottom: 8 }}>
                Bio (Optional)
              </Text>
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView intensity={Platform.OS === "ios" ? 40 : 80} tint="dark" style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)" }}>
                  <LinearGradient colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                      placeholder="Tell us about yourself..."
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                      style={{ paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: "#FFFFFF", minHeight: 100, textAlignVertical: "top" }}
                      multiline
                      numberOfLines={4}
                      maxLength={200}
                      returnKeyType="done"
                    />
                  </LinearGradient>
                </BlurView>
              </View>
              <Text style={{ fontSize: 12, color: "rgba(255, 255, 255, 0.5)", marginTop: 4 }}>
                {bio.length}/200
              </Text>
            </View>

            {/* Continue Button */}
            <View>
              <Pressable
                onPress={handleContinue}
                disabled={!name.trim()}
                style={{ overflow: 'hidden', borderRadius: 16 }}
              >
                <LinearGradient
                  colors={
                    !name.trim()
                      ? ["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]
                      : ["#3B82F6", "#8B5CF6", "#EC4899"] // Blue -> Purple -> Pink
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={{
                    paddingVertical: 18,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <Text className="text-white text-lg font-bold">
                    Continue
                  </Text>
                  
                  {/* Shimmer Overlay */}
                  {!!name.trim() && (
                    <Animated.View
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        width: 60,
                        transform: [
                          { translateX: shimmerTranslate },
                          { skewX: "-20deg" }
                        ],
                      }}
                    >
                      <LinearGradient
                        colors={[
                          "transparent",
                          "rgba(255, 255, 255, 0.4)",
                          "transparent",
                        ]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={{ flex: 1 }}
                      />
                    </Animated.View>
                  )}
                </LinearGradient>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
};

export default OnboardingNameScreen;
