import React, { useState } from "react";
import { View, FlatList, Pressable, Dimensions, Text } from "react-native";
import { Image } from "expo-image";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { ZoomableImageViewer } from "@/components/ZoomableImageViewer";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { RootStackScreenProps } from "@/navigation/types";

const SCREEN_WIDTH = Dimensions.get("window").width;
const COLUMN_COUNT = 3;
const ITEM_SIZE = SCREEN_WIDTH / COLUMN_COUNT;

const GroupSettingsMediaScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RootStackScreenProps<"GroupSettingsMedia">["route"]>();
  const navigation = useNavigation();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const { chatId } = route.params;

  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const { data: mediaMessages = [], isLoading } = useQuery({
    queryKey: ["chatMedia", chatId],
    queryFn: () => api.get<any[]>(`/api/chats/${chatId}/media?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  const renderItem = ({ item }: { item: any }) => {
    const imageUrl = getFullImageUrl(item.thumbnailUrl || item.imageUrl || (item.metadata && item.metadata.videoUrl)); // Fallback for various structures
    
    // If it's a video, we might want a play icon overlay, but let's just show image for now
    
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync();
          setSelectedImage(getFullImageUrl(item.imageUrl || item.thumbnailUrl));
        }}
        style={{
          width: ITEM_SIZE,
          height: ITEM_SIZE,
          borderWidth: 1,
          borderColor: colors.background,
        }}
      >
        <Image
          source={{ uri: imageUrl }}
          style={{ width: "100%", height: "100%" }}
          contentFit="cover"
          transition={200}
        />
      </Pressable>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
       {/* Background */}
       <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}>
        <LinearGradient
          colors={isDark ? ["#000000", "#0A0A0F", "#000000"] : [colors.background, colors.backgroundSecondary, colors.background]}
          style={{ flex: 1 }}
        />
      </View>

      {/* Header handled by Navigation options usually, but let's ensure padding */}
      
      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <LuxeLogoLoader size="large" />
        </View>
      ) : (
        <FlatList
          data={mediaMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          numColumns={COLUMN_COUNT}
          contentContainerStyle={{
            paddingTop: insets.top + 60, // Space for transparent header
            paddingBottom: insets.bottom,
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No media shared yet</Text>
            </View>
          }
        />
      )}

      {selectedImage && (
        <ZoomableImageViewer
          visible={!!selectedImage}
          imageUrl={selectedImage}
          onClose={() => setSelectedImage(null)}
        />
      )}
    </View>
  );
};

export default GroupSettingsMediaScreen;

