import React, { useState, useRef } from "react";
import {
  View,
  Modal,
  Pressable,
  Image,
  Text,
  Dimensions,
  Alert,
  Animated as RNAnimated,
  ActivityIndicator,
} from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import * as FileSystem from "expo-file-system";
import * as MediaLibrary from "expo-media-library";
import * as Sharing from "expo-sharing";
import { X, Download, Share2, CheckSquare, Edit2 } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  runOnJS,
} from "react-native-reanimated";
import {
  GestureDetector,
  Gesture,
  GestureHandlerRootView,
} from "react-native-gesture-handler";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ZoomableImageViewerProps {
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
  senderName?: string;
  timestamp?: string;
  messageId?: string;
  caption?: string;
  isOwnMessage?: boolean;
  onSelectImage?: (messageId: string) => void;
  onEditCaption?: (message: any) => void;
  showToolbar?: boolean;
}

export const ZoomableImageViewer: React.FC<ZoomableImageViewerProps> = ({
  visible,
  imageUrl,
  onClose,
  senderName,
  timestamp,
  messageId,
  caption,
  isOwnMessage,
  onSelectImage,
  onEditCaption,
  showToolbar = true,
}) => {
  const [isSaving, setIsSaving] = useState(false);
  const [toolbarVisible, setToolbarVisible] = useState(true);
  const toolbarAnim = useRef(new RNAnimated.Value(1)).current;

  // Animated values for zoom and pan
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  // Reset zoom and pan
  const resetZoom = () => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  };

  // Toggle toolbar visibility
  const toggleToolbar = () => {
    const toValue = toolbarVisible ? 0 : 1;
    setToolbarVisible(!toolbarVisible);
    RNAnimated.timing(toolbarAnim, {
      toValue,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  // Pinch gesture
  const pinchGesture = Gesture.Pinch()
    .onUpdate((e) => {
      const newScale = savedScale.value * e.scale;
      scale.value = Math.max(1, Math.min(5, newScale));
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      // If zoomed out below 1, reset to 1
      if (scale.value < 1) {
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      }
    });

  // Pan gesture
  const panGesture = Gesture.Pan()
    .onUpdate((e) => {
      // Only allow panning if zoomed in
      if (scale.value > 1) {
        translateX.value = savedTranslateX.value + e.translationX;
        translateY.value = savedTranslateY.value + e.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;

      // Apply boundaries to prevent panning too far
      const maxTranslateX = (SCREEN_WIDTH * (scale.value - 1)) / 2;
      const maxTranslateY = (SCREEN_HEIGHT * (scale.value - 1)) / 2;

      if (Math.abs(translateX.value) > maxTranslateX) {
        translateX.value = withSpring(Math.sign(translateX.value) * maxTranslateX);
        savedTranslateX.value = translateX.value;
      }
      if (Math.abs(translateY.value) > maxTranslateY) {
        translateY.value = withSpring(Math.sign(translateY.value) * maxTranslateY);
        savedTranslateY.value = translateY.value;
      }
    });

  // Double tap to zoom
  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd(() => {
      if (scale.value > 1) {
        // Zoom out
        scale.value = withSpring(1);
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedScale.value = 1;
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        // Zoom in to 2x
        scale.value = withSpring(2);
        savedScale.value = 2;
      }
    });

  // Single tap to toggle toolbar
  const singleTapGesture = Gesture.Tap()
    .numberOfTaps(1)
    .onEnd(() => {
      runOnJS(toggleToolbar)();
    });

  // Compose gestures
  const composedGesture = Gesture.Race(
    doubleTapGesture,
    Gesture.Simultaneous(pinchGesture, panGesture),
    singleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  const handleSaveImage = async () => {
    try {
      setIsSaving(true);
      console.log("Attempting to save image...");

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Required", "Please grant permission to save images to your library.");
        return;
      }

      // Get file extension from URL or default to jpg
      const extension = imageUrl.split(".").pop()?.split("?")[0] || "jpg";
      const fileName = `vibechat_${Date.now()}.${extension}`;
      const fileUri = `${FileSystem.cacheDirectory}${fileName}`;
      
      console.log("Downloading to:", fileUri);
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      
      console.log("Saving to library...");
      await MediaLibrary.saveToLibraryAsync(downloadResult.uri);

      Alert.alert("Success", "Image saved to your library!");
    } catch (error) {
      console.error("Error saving image:", error);
      Alert.alert("Error", "Failed to save image");
    } finally {
      setIsSaving(false);
    }
  };

  const handleShareImage = async () => {
    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Error", "Sharing is not available on this device");
        return;
      }

      const fileUri = `${FileSystem.cacheDirectory}share-image.jpg`;
      const downloadResult = await FileSystem.downloadAsync(imageUrl, fileUri);
      await Sharing.shareAsync(downloadResult.uri);
    } catch (error) {
      console.error("Error sharing image:", error);
      Alert.alert("Error", "Failed to share image");
    }
  };

  const handleSelectImage = () => {
    if (onSelectImage && messageId) {
      onSelectImage(messageId);
      onClose();
    }
  };

  const handleEditCaption = () => {
    if (onEditCaption && messageId) {
      onEditCaption({ id: messageId, content: caption });
      onClose();
    }
  };

  // Reset when modal closes
  const handleClose = () => {
    resetZoom();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <View
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.98)",
          }}
        >
          {/* Close button */}
          {showToolbar && (
            <RNAnimated.View
              style={{
                position: "absolute",
                top: 50,
                right: 20,
                zIndex: 10,
                opacity: toolbarAnim,
                transform: [{
                  translateY: toolbarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              }}
            >
              <Pressable
                onPress={handleClose}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  overflow: "hidden",
                }}
              >
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    flex: 1,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  <X size={24} color="#FFFFFF" />
                </BlurView>
              </Pressable>
            </RNAnimated.View>
          )}

          {/* Info Bar */}
          {showToolbar && senderName && (
            <RNAnimated.View
              style={{
                position: "absolute",
                top: 50,
                left: 20,
                right: 80,
                zIndex: 10,
                opacity: toolbarAnim,
                transform: [{
                  translateY: toolbarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              }}
            >
              <View
                style={{
                  borderRadius: 16,
                  overflow: "hidden",
                }}
              >
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "600" }}>
                    {senderName}
                  </Text>
                  {timestamp && (
                    <Text style={{ color: "#A0A0A0", fontSize: 13, marginTop: 2 }}>
                      {timestamp}
                    </Text>
                  )}
                  {caption && (
                    <Text style={{ color: "#E0E0E0", fontSize: 14, marginTop: 8, lineHeight: 18 }}>
                      {caption}
                    </Text>
                  )}
                </BlurView>
              </View>
            </RNAnimated.View>
          )}

          {/* Zoomable Image */}
          <GestureDetector gesture={composedGesture}>
            <Animated.View
              style={{
                flex: 1,
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Animated.View style={animatedStyle}>
                <Image
                  source={{ uri: imageUrl }}
                  style={{
                    width: SCREEN_WIDTH,
                    height: SCREEN_HEIGHT,
                  }}
                  resizeMode="contain"
                />
              </Animated.View>
            </Animated.View>
          </GestureDetector>

          {/* Action Buttons */}
          {showToolbar && (
            <RNAnimated.View
              style={{
                position: "absolute",
                bottom: 40,
                left: 0,
                right: 0,
                zIndex: 10,
                opacity: toolbarAnim,
                transform: [{
                  translateY: toolbarAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              }}
            >
              <View
                style={{
                  marginHorizontal: 20,
                  borderRadius: 20,
                  overflow: "hidden",
                }}
              >
                <BlurView
                  intensity={30}
                  tint="dark"
                  style={{
                    paddingVertical: 16,
                    paddingHorizontal: 20,
                  }}
                >
                  <LinearGradient
                    colors={["rgba(255, 255, 255, 0.15)", "rgba(255, 255, 255, 0.05)"]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                    }}
                  />
                  <View
                    style={{
                      flexDirection: "row",
                      justifyContent: "space-around",
                      alignItems: "center",
                    }}
                  >
                    {/* Save Button */}
                    <Pressable
                      onPress={handleSaveImage}
                      disabled={isSaving}
                      style={{
                        alignItems: "center",
                        paddingHorizontal: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                      >
                        {isSaving ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <Download size={22} color="#FFFFFF" />
                        )}
                      </View>
                      <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Save</Text>
                    </Pressable>

                    {/* Share Button */}
                    <Pressable
                      onPress={handleShareImage}
                      style={{
                        alignItems: "center",
                        paddingHorizontal: 12,
                      }}
                    >
                      <View
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: 24,
                          backgroundColor: "rgba(255, 255, 255, 0.1)",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 6,
                        }}
                      >
                        <Share2 size={22} color="#FFFFFF" />
                      </View>
                      <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Share</Text>
                    </Pressable>

                    {/* Select Button */}
                    {onSelectImage && messageId && (
                      <Pressable
                        onPress={handleSelectImage}
                        style={{
                          alignItems: "center",
                          paddingHorizontal: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 6,
                          }}
                        >
                          <CheckSquare size={22} color="#FFFFFF" />
                        </View>
                        <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Select</Text>
                      </Pressable>
                    )}

                    {/* Edit Caption Button */}
                    {isOwnMessage && onEditCaption && (
                      <Pressable
                        onPress={handleEditCaption}
                        style={{
                          alignItems: "center",
                          paddingHorizontal: 12,
                        }}
                      >
                        <View
                          style={{
                            width: 48,
                            height: 48,
                            borderRadius: 24,
                            backgroundColor: "rgba(255, 255, 255, 0.1)",
                            alignItems: "center",
                            justifyContent: "center",
                            marginBottom: 6,
                          }}
                        >
                          <Edit2 size={22} color="#FFFFFF" />
                        </View>
                        <Text style={{ color: "#FFFFFF", fontSize: 12 }}>Edit</Text>
                      </Pressable>
                    )}
                  </View>
                </BlurView>
              </View>
            </RNAnimated.View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
};

