import React from "react";
import { View, Text, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Globe } from "lucide-react-native";

const CommunityScreen = () => {
  const insets = useSafeAreaInsets();

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
        <View style={{ alignItems: "center", marginTop: 40 }}>
            <View style={{ 
                width: 80, 
                height: 80, 
                borderRadius: 40, 
                backgroundColor: "rgba(255, 255, 255, 0.1)",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20
            }}>
                <Globe size={40} color="#FFF" />
            </View>
            <Text style={{ fontSize: 32, fontWeight: "bold", color: "#FFFFFF", marginBottom: 16 }}>
                VibeChat Community
            </Text>
            <Text style={{ fontSize: 16, color: "rgba(255, 255, 255, 0.6)", textAlign: "center" }}>
                Coming Soon
            </Text>
        </View>
      </ScrollView>
    </View>
  );
};

export default CommunityScreen;

