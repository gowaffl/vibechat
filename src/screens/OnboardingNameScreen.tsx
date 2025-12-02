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
  Dimensions,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import type { RootStackScreenProps } from "@/navigation/types";
import { OnboardingProgress } from "@/components/OnboardingProgress";

const { width, height } = Dimensions.get("window");

const OnboardingNameScreen = () => {
  const navigation = useNavigation<RootStackScreenProps<"OnboardingName">["navigation"]>();
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const imageScaleAnim = useRef(new Animated.Value(0.9)).current;
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
      Animated.spring(imageScaleAnim, {
        toValue: 1,
        tension: 40,
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
            "rgba(79, 195, 247, 0.05)",
            "rgba(0, 122, 255, 0.03)",
            "transparent",
            "rgba(52, 199, 89, 0.03)",
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
        />
      </View>
      
      <View style={{ flex: 1, paddingTop: 60 }}>
         {/* Top Progress Bar */}
         <View style={{ alignItems: "center", marginBottom: 20 }}>
           <OnboardingProgress totalSteps={4} currentStep={2} />
      </View>
      
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={0}
      >
        <ScrollView
                contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          bounces={false}
                showsVerticalScrollIndicator={false}
            >
                <View style={{ flex: 1 }}>
                    {/* Glitch Mascot - Centered Top */}
                    <Animated.View
                      style={{
                        alignItems: "center",
                        justifyContent: "center",
                        marginTop: 10,
                        opacity: isKeyboardVisible ? 0.5 : 1,
                        transform: [
                          { scale: isKeyboardVisible ? 0.7 : imageScaleAnim },
                          { translateY: isKeyboardVisible ? -40 : 0 }
                        ],
                        height: isKeyboardVisible ? height * 0.2 : height * 0.35,
                      }}
                    >
                       {/* Glowing background effect */}
                       <View style={{
                         position: "absolute",
                         width: 200,
                         height: 200,
                         backgroundColor: "rgba(52, 211, 153, 0.15)", // Green glow
                         borderRadius: 100,
                         top: "15%",
                       }} />
                       
                      <Image
                        source={require("../../assets/glitch_bio.png")}
                        style={{ 
                          width: width * 0.8, 
                          height: width * 0.8,
                          maxWidth: 350,
                          maxHeight: 350,
                        }}
                        contentFit="contain"
                      />
                    </Animated.View>

                    {/* Bottom Content */}
          <Animated.View
                        className="flex-1 px-6 pb-8"
            style={{
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
                          justifyContent: "flex-end",
            }}
          >
                        <View style={{ alignItems: "center", marginBottom: 32 }}>
                          <Text style={{ fontSize: 28, fontWeight: "700", color: "#FFFFFF", marginBottom: 12, textAlign: "center" }}>
                            What should we call you?
              </Text>
                          <Text style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", textAlign: "center", paddingHorizontal: 16 }}>
                            This is how you'll appear to your friends. You can always change it later.
              </Text>
            </View>

            {/* Name Input */}
                        <View style={{ marginBottom: 20 }}>
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView intensity={Platform.OS === "ios" ? 40 : 80} tint="dark" style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)" }}>
                  <LinearGradient colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <TextInput
                      value={name}
                      onChangeText={setName}
                                  placeholder="Your Name"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                  style={{ paddingHorizontal: 16, paddingVertical: 16, fontSize: 18, color: "#FFFFFF", fontWeight: "500" }}
                      autoCapitalize="words"
                      maxLength={50}
                      returnKeyType="next"
                      keyboardAppearance="dark"
                    />
                  </LinearGradient>
                </BlurView>
              </View>
            </View>

            {/* Bio Input */}
            <View style={{ marginBottom: 32 }}>
              <View style={{ borderRadius: 16, overflow: "hidden" }}>
                <BlurView intensity={Platform.OS === "ios" ? 40 : 80} tint="dark" style={{ borderRadius: 16, borderWidth: 1, borderColor: "rgba(255, 255, 255, 0.2)" }}>
                  <LinearGradient colors={["rgba(255, 255, 255, 0.08)", "rgba(255, 255, 255, 0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    <TextInput
                      value={bio}
                      onChangeText={setBio}
                                  placeholder="Short bio (optional)"
                      placeholderTextColor="rgba(255, 255, 255, 0.4)"
                                  style={{ paddingHorizontal: 16, paddingVertical: 16, fontSize: 16, color: "#FFFFFF", minHeight: 80, textAlignVertical: "top" }}
                      multiline
                                  numberOfLines={3}
                      maxLength={200}
                      returnKeyType="done"
                      keyboardAppearance="dark"
                    />
                  </LinearGradient>
                </BlurView>
              </View>
            </View>

            {/* Continue Button */}
              <Pressable
                onPress={handleContinue}
                disabled={!name.trim()}
                style={{ overflow: 'hidden', borderRadius: 16 }}
              >
                <LinearGradient
                  colors={
                    !name.trim()
                      ? ["rgba(255, 255, 255, 0.1)", "rgba(255, 255, 255, 0.05)"]
                                  : ["#0061FF", "#00C6FF", "#00E676"] // New VibeChat Gradient
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
                    </Animated.View>
            </View>
        </ScrollView>
      </KeyboardAvoidingView>
      </View>
    </View>
  );
};

export default OnboardingNameScreen;
