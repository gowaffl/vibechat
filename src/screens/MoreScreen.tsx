import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { Settings, Info, Shield, CircleHelp } from "lucide-react-native";
import { GradientIcon } from "@/components/GradientIcon";
import { GradientText } from "@/components/GradientText";

const MoreScreen = () => {
  const insets = useSafeAreaInsets();

  const MenuItem = ({ icon, label, onPress }: { icon: React.ReactNode, label: string, onPress?: () => void }) => (
    <View style={{ marginBottom: 16 }}>
      <BlurView
        intensity={40}
        tint="dark"
        style={{
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.1)",
        }}
      >
        <LinearGradient
          colors={["rgba(255, 255, 255, 0.05)", "rgba(255, 255, 255, 0.02)"]}
          style={{
            flexDirection: "row",
            alignItems: "center",
            padding: 16,
          }}
        >
          <View style={{ 
            width: 40, 
            height: 40, 
            borderRadius: 20, 
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            alignItems: "center",
            justifyContent: "center",
            marginRight: 16
          }}>
            {icon}
          </View>
          <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>{label}</Text>
        </LinearGradient>
      </BlurView>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: "#000000" }}>
      {/* Background */}
      <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={["#000000", "#0A0A0F", "#050508", "#000000"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ flex: 1 }}
        />
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 20, paddingBottom: 100 }}>
        <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFFFFF", marginBottom: 32 }}>
          More
        </Text>

        <MenuItem 
          icon={<Settings size={24} color="#FFF" />} 
          label="Settings"
        />
        <MenuItem 
          icon={<Shield size={24} color="#FFF" />} 
          label="Privacy & Security"
        />
        <MenuItem 
          icon={<CircleHelp size={24} color="#FFF" />} 
          label="Help & Support"
        />
        <MenuItem 
          icon={<Info size={24} color="#FFF" />} 
          label="About VibeChat"
        />
        
        <View style={{ marginTop: 32, alignItems: "center" }}>
          <Text style={{ color: "rgba(255, 255, 255, 0.3)", fontSize: 12 }}>
            Version 1.0.0
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default MoreScreen;

