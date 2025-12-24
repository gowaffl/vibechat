import React, { useMemo } from "react";
import { View, FlatList, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { useRoute, useNavigation } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { api } from "@/lib/api";
import { useUser } from "@/contexts/UserContext";
import { useTheme } from "@/contexts/ThemeContext";
import { LinkPreviewCard } from "@/components/LinkPreviewCard";
import { LuxeLogoLoader } from "@/components/LuxeLogoLoader";
import type { RootStackScreenProps } from "@/navigation/types";

const GroupSettingsLinksScreen = () => {
  const insets = useSafeAreaInsets();
  const route = useRoute<RootStackScreenProps<"GroupSettingsLinks">["route"]>();
  const { user } = useUser();
  const { colors, isDark } = useTheme();
  const { chatId } = route.params;

  // We reuse the messages query but might want to fetch all or have a dedicated endpoint ideally.
  // For now, consistent with GroupSettings logic.
  const { data: messagesData, isLoading } = useQuery({
    queryKey: ["messages", chatId],
    queryFn: () => api.get<{ messages: any[], hasMore: boolean, nextCursor: string | null }>(`/api/chats/${chatId}/messages?userId=${user?.id}`),
    enabled: !!user?.id && !!chatId,
  });

  const messages = messagesData?.messages || [];

  const linkMessages = useMemo(() => {
    return messages.filter((msg: any) => 
      msg.linkPreview && msg.linkPreview.url && !msg.isUnsent
    );
  }, [messages]);

  const renderItem = ({ item }: { item: any }) => {
    return (
        <View style={{ paddingHorizontal: 20, marginBottom: 12 }}>
            <LinkPreviewCard
                linkPreview={item.linkPreview}
                isCurrentUser={item.senderId === user?.id}
                isAI={false} // Assuming these are user links mostly
            />
        </View>
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

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
          <LuxeLogoLoader size="large" />
        </View>
      ) : (
        <FlatList
          data={linkMessages}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{
            paddingTop: insets.top + 60,
            paddingBottom: insets.bottom + 20,
          }}
          ListEmptyComponent={
            <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 100 }}>
              <Text style={{ color: colors.textSecondary, fontSize: 16 }}>No links shared yet</Text>
            </View>
          }
        />
      )}
    </View>
  );
};

export default GroupSettingsLinksScreen;

