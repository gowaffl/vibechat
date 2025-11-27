import React, { useRef, useEffect } from "react";
import {
  View,
  Text,
  Pressable,
  Animated,
  Easing,
  StyleSheet,
  Linking,
} from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useNavigation } from "@react-navigation/native";
import { TERMS_OF_SERVICE_URL, PRIVACY_POLICY_URL } from "@/constants/legal";

const WelcomeScreen = () => {
  const navigation = useNavigation<any>();
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const bounceAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Initial Entry Animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Slow Breathing/Pulsing Animation
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
            Animated.timing(pulseAnim, {
                toValue: 1.05,
                duration: 3000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
                toValue: -10,
                duration: 3000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            })
        ]),
        Animated.parallel([
            Animated.timing(pulseAnim, {
                toValue: 1,
                duration: 3000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            }),
            Animated.timing(bounceAnim, {
                toValue: 0,
                duration: 3000,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
            })
        ])
      ])
    ).start();
  }, []);

  const handleAgreeAndContinue = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.navigate("PhoneAuth");
  };

  const openLink = (url: string) => {
    Linking.openURL(url).catch((err) => console.error("Couldn't load page", err));
  };

  return (
    <View style={styles.container}>
      {/* Animated Gradient Background */}
      <View style={styles.backgroundContainer}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.flexOne}
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
          style={styles.overlayGradient}
        />
      </View>

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
          },
        ]}
      >
        {/* Logo & Branding */}
        <View style={styles.logoContainer}>
          <Animated.View 
            style={[
                styles.logoWrapper,
                {
                    transform: [
                        { scale: pulseAnim },
                        { translateY: bounceAnim }
                    ]
                }
            ]}
          >
            <Image
              source={require("../../assets/vibechat logo main.png")}
              style={styles.logo}
              contentFit="contain"
            />
          </Animated.View>
        </View>

        {/* Bottom Section */}
        <View style={styles.bottomSection}>
          <Text style={styles.legalText}>
            Read our{" "}
            <Text style={styles.link} onPress={() => openLink(PRIVACY_POLICY_URL)}>
              Privacy Policy
            </Text>
            . Tap "Agree & Continue" to accept the{" "}
            <Text style={styles.link} onPress={() => openLink(TERMS_OF_SERVICE_URL)}>
              Terms of Service
            </Text>
            .
          </Text>

          <Pressable
            onPress={handleAgreeAndContinue}
            style={styles.buttonContainer}
          >
            <LinearGradient
              colors={["#0061FF", "#00C6FF", "#00E676"]} // New VibeChat Gradient: Deep Blue -> Bright Cyan -> Neon Green
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.buttonGradient}
            >
              <Text style={styles.buttonText}>Agree & Continue</Text>
            </LinearGradient>
          </Pressable>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  flexOne: {
    flex: 1,
  },
  backgroundContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  content: {
    flex: 1,
    justifyContent: "space-between",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  logoContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  logoWrapper: {
    width: 280,
    height: 280,
    alignItems: "center",
    justifyContent: "center",
  },
  logo: {
    width: "100%",
    height: "100%",
  },
  appName: {
    fontSize: 42,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
    letterSpacing: 1,
  },
  tagline: {
    fontSize: 18,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    letterSpacing: 0.5,
  },
  bottomSection: {
    marginTop: "auto",
    paddingBottom: 40,
  },
  legalText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 20,
  },
  link: {
    color: "#3B82F6",
  },
  buttonContainer: {
    overflow: "hidden",
    borderRadius: 16,
    shadowColor: "#3B82F6",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

export default WelcomeScreen;
