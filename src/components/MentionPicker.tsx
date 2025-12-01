import React from "react";
import {
  View,
  Text,
  FlatList,
  Pressable,
  Image,
  Animated,
  ScrollView,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import type { User, Thread, AIFriend } from "@/shared/contracts";
import { getInitials, getColorFromName } from "@/utils/avatarHelpers";
import { getFullImageUrl } from "@/utils/imageHelpers";

interface MentionPickerProps {
  visible: boolean;
  users: User[];
  threads?: Thread[];
  aiFriends?: AIFriend[]; // Multiple AI friends
  onSelectUser: (user: User) => void;
  onSelectThread?: (thread: Thread) => void;
  onSelectAI?: (aiFriend: AIFriend) => void;
  searchQuery: string;
  // Deprecated: use aiFriends instead
  aiName?: string;
}

const MentionPicker: React.FC<MentionPickerProps> = ({
  visible,
  users,
  threads = [],
  aiFriends = [],
  onSelectUser,
  onSelectThread,
  onSelectAI,
  searchQuery,
  aiName, // Deprecated
}) => {
  const slideAnim = React.useRef(new Animated.Value(300)).current;
  const opacityAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(slideAnim, {
          toValue: 0,
          useNativeDriver: true,
          tension: 100,
          friction: 12,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 300,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, slideAnim, opacityAnim]);

  if (!visible) return null;

  // Filter users based on search query
  const filteredUsers = users.filter((user) =>
    user.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter threads based on search query
  const filteredThreads = threads.filter((thread) =>
    thread.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Filter AI friends based on search query
  const filteredAIFriends = onSelectAI
    ? aiFriends.filter((friend) =>
        friend.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : [];

  console.log('[MentionPicker] Rendering:', {
    visible,
    totalUsers: users.length,
    totalThreads: threads.length,
    totalAIFriends: aiFriends.length,
    searchQuery,
    filteredUsersCount: filteredUsers.length,
    filteredThreadsCount: filteredThreads.length,
    filteredAIFriendsCount: filteredAIFriends.length,
    filteredUserNames: filteredUsers.map(u => u.name),
    filteredThreadNames: filteredThreads.map(t => t.name),
    filteredAIFriendNames: filteredAIFriends.map(f => f.name),
  });

  if (filteredUsers.length === 0 && filteredThreads.length === 0 && filteredAIFriends.length === 0) {
    console.log('[MentionPicker] No users, threads, or AI friends match search query');
    return null;
  }

  return (
    <Animated.View
      style={{
        maxHeight: 280,
        opacity: opacityAnim,
        transform: [{ translateY: slideAnim }],
      }}
    >
      <View
        style={{
          marginHorizontal: 16,
          borderRadius: 14,
          overflow: "hidden",
          shadowColor: "#000",
          shadowOffset: { width: 0, height: -2 },
          shadowOpacity: 0.15,
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <BlurView intensity={95} tint="systemChromeMaterialDark" style={{ overflow: "hidden" }}>
          <View
            style={{
              backgroundColor: "rgba(28, 28, 30, 0.95)",
              borderRadius: 14,
              borderWidth: 0.5,
              borderColor: "rgba(255, 255, 255, 0.1)",
            }}
          >
            <ScrollView
              style={{ maxHeight: 280 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingVertical: 8 }}
              keyboardShouldPersistTaps="handled"
            >
              {/* AI Friends Section */}
              {filteredAIFriends.length > 0 && (
                <View style={{ paddingLeft: 12 }}>
                  {/* AI Header */}
                  <View style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "rgba(20, 184, 166, 0.8)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      AI Friends
                    </Text>
                  </View>
                  
                  {filteredAIFriends.map((friend, index) => (
                    <React.Fragment key={friend.id}>
                      {index > 0 && (
                        <View
                          style={{
                            height: 0.33,
                            backgroundColor: "rgba(20, 184, 166, 0.15)",
                            marginLeft: 44,
                          }}
                        />
                      )}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          console.log('[MentionPicker] AI friend selected:', friend.name);
                          onSelectAI?.(friend);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingRight: 16,
                            paddingVertical: 8,
                          }}
                        >
                          {/* AI Avatar with color indicator */}
                          <View style={{ marginRight: 12 }}>
                            <Image
                              source={require("../../assets/vibechat logo main.png")}
                              style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                              }}
                              resizeMode="cover"
                            />
                            {/* Color indicator badge */}
                            <View
                              style={{
                                position: "absolute",
                                bottom: -2,
                                right: -2,
                                width: 14,
                                height: 14,
                                borderRadius: 7,
                                backgroundColor: "#14B8A6",
                                borderWidth: 2,
                                borderColor: "rgba(28, 28, 30, 0.95)",
                              }}
                            />
                          </View>

                          {/* AI Name */}
                          <Text
                            style={{
                              fontSize: 15,
                              fontWeight: "600",
                              color: "#14B8A6",
                            }}
                            numberOfLines={1}
                          >
                            {friend.name}
                          </Text>
                        </View>
                      </Pressable>
                    </React.Fragment>
                  ))}
                </View>
              )}

              {/* Users Section */}
              {filteredUsers.length > 0 && (
                <View style={{ paddingLeft: 12, marginTop: filteredAIFriends.length > 0 ? 8 : 0 }}>
                  {/* Separator between AI and users */}
                  {filteredAIFriends.length > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "rgba(52, 199, 89, 0.2)",
                        marginVertical: 8,
                        marginRight: 12,
                      }}
                    />
                  )}

                  {/* Users Header */}
                  <View style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "rgba(255, 255, 255, 0.5)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Members
                    </Text>
                  </View>
                  
                  {filteredUsers.map((user, index) => {
                    const initials = getInitials(user.name);
                    const backgroundColor = getColorFromName(user.name);
                    
                    return (
                      <React.Fragment key={user.id}>
                        {index > 0 && (
                          <View
                            style={{
                              height: 0.33,
                              backgroundColor: "rgba(255, 255, 255, 0.06)",
                              marginLeft: 44,
                            }}
                          />
                        )}
                        <Pressable
                          onPress={() => {
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                            console.log('[MentionPicker] User selected:', user.name);
                            onSelectUser(user);
                          }}
                        >
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              paddingRight: 16,
                              paddingVertical: 8,
                            }}
                          >
                            {/* User Avatar */}
                            {user.image && getFullImageUrl(user.image) ? (
                              <Image
                                source={{ uri: getFullImageUrl(user.image) }}
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  marginRight: 12,
                                }}
                                resizeMode="cover"
                              />
                            ) : (
                              <View
                                style={{
                                  width: 32,
                                  height: 32,
                                  borderRadius: 16,
                                  alignItems: "center",
                                  justifyContent: "center",
                                  backgroundColor: backgroundColor,
                                  marginRight: 12,
                                }}
                              >
                                <Text
                                  style={{
                                    color: "#FFFFFF",
                                    fontSize: 13,
                                    fontWeight: "600",
                                  }}
                                >
                                  {initials}
                                </Text>
                              </View>
                            )}

                            {/* User Name */}
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "500",
                                color: "#FFFFFF",
                              }}
                              numberOfLines={1}
                            >
                              {user.name}
                            </Text>
                          </View>
                        </Pressable>
                      </React.Fragment>
                    );
                  })}
                </View>
              )}

              {/* Threads Section */}
              {filteredThreads.length > 0 && onSelectThread && (
                <View style={{ paddingLeft: 12, marginTop: filteredUsers.length > 0 ? 8 : 0 }}>
                  {/* Separator between users and threads */}
                  {filteredUsers.length > 0 && (
                    <View
                      style={{
                        height: 1,
                        backgroundColor: "rgba(20, 184, 166, 0.2)",
                        marginVertical: 8,
                        marginRight: 12,
                      }}
                    />
                  )}
                  
                  {/* Threads Header */}
                  <View style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: "rgba(20, 184, 166, 0.8)",
                        textTransform: "uppercase",
                        letterSpacing: 0.5,
                      }}
                    >
                      Smart Threads
                    </Text>
                  </View>
                  
                  {filteredThreads.map((thread, index) => (
                    <React.Fragment key={thread.id}>
                      {index > 0 && (
                        <View
                          style={{
                            height: 0.33,
                            backgroundColor: "rgba(255, 255, 255, 0.06)",
                            marginLeft: 44,
                          }}
                        />
                      )}
                      <Pressable
                        onPress={() => {
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          console.log('[MentionPicker] Thread selected:', thread.name);
                          onSelectThread(thread);
                        }}
                      >
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            paddingRight: 16,
                            paddingVertical: 8,
                          }}
                        >
                          {/* Thread Icon */}
                          <View
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 16,
                              alignItems: "center",
                              justifyContent: "center",
                              backgroundColor: "rgba(20, 184, 166, 0.2)",
                              borderWidth: 1,
                              borderColor: "rgba(20, 184, 166, 0.4)",
                              marginRight: 12,
                            }}
                          >
                            <Text style={{ fontSize: 16 }}>
                              {thread.icon || "💬"}
                            </Text>
                          </View>

                          {/* Thread Name with @ prefix */}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={{
                                fontSize: 15,
                                fontWeight: "500",
                                color: "#14B8A6",
                              }}
                              numberOfLines={1}
                            >
                              @{thread.name.toLowerCase()}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: "rgba(255, 255, 255, 0.4)",
                                marginTop: 2,
                              }}
                              numberOfLines={1}
                            >
                              Guaranteed to thread
                            </Text>
                          </View>
                        </View>
                      </Pressable>
                    </React.Fragment>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </BlurView>
      </View>
    </Animated.View>
  );
};

export default MentionPicker;

