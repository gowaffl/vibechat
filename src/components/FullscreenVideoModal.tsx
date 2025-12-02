import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Modal,
  Pressable,
  Dimensions,
  StyleSheet,
  StatusBar,
  Text,
} from "react-native";
import { useVideoPlayer, VideoView, type VideoView as VideoViewType } from "expo-video";
import { useEvent } from "expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  runOnJS,
  useAnimatedGestureHandler,
} from "react-native-reanimated";
import { PanGestureHandler, GestureHandlerRootView } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface FullscreenVideoModalProps {
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
  initialMuted?: boolean;
}

export const FullscreenVideoModal: React.FC<FullscreenVideoModalProps> = ({
  visible,
  videoUrl,
  onClose,
  initialMuted = false,
}) => {
  const insets = useSafeAreaInsets();
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(initialMuted);
  const [showControls, setShowControls] = useState(true);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const videoViewRef = useRef<VideoViewType>(null);
  
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);
  const controlsOpacity = useSharedValue(1);

  // Initialize video player
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = true;
    player.muted = initialMuted;
  });

  // Subscribe to player events
  const { isPlaying: playerIsPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  // Sync playing state
  useEffect(() => {
    setIsPlaying(playerIsPlaying);
  }, [playerIsPlaying]);

  // Auto-play when modal opens
  useEffect(() => {
    if (visible) {
      player.play();
      setShowControls(true);
      controlsOpacity.value = 1;
    } else {
      player.pause();
    }
  }, [visible, player]);

  // Auto-hide controls
  useEffect(() => {
    if (isPlaying && showControls && visible) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 300 });
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls, visible]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    player.pause();
    onClose();
  }, [onClose, player]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    resetControlsTimer();
  }, [isPlaying, player]);

  const handleMuteToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    player.muted = newMuted;
    resetControlsTimer();
  }, [isMuted, player]);

  const resetControlsTimer = useCallback(() => {
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
    setShowControls(true);
    controlsOpacity.value = withSpring(1);
  }, []);

  const handleVideoPress = useCallback(() => {
    const newShowControls = !showControls;
    setShowControls(newShowControls);
    controlsOpacity.value = withTiming(newShowControls ? 1 : 0, { duration: 200 });
    
    if (newShowControls) {
      resetControlsTimer();
    }
  }, [showControls, resetControlsTimer]);

  // Gesture handler for swipe to dismiss
  const gestureHandler = useAnimatedGestureHandler({
    onStart: () => {
      // Reset values
    },
    onActive: (event) => {
      // Only allow downward swipe
      if (event.translationY > 0) {
        translateY.value = event.translationY;
        // Calculate opacity and scale based on drag distance
        const progress = Math.min(event.translationY / 300, 1);
        opacity.value = 1 - progress * 0.5;
        scale.value = 1 - progress * 0.1;
      }
    },
    onEnd: (event) => {
      // If dragged more than 150px or velocity is high, close the modal
      if (event.translationY > 150 || event.velocityY > 500) {
        translateY.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
        opacity.value = withTiming(0, { duration: 200 });
        runOnJS(handleClose)();
      } else {
        // Spring back
        translateY.value = withSpring(0);
        opacity.value = withSpring(1);
        scale.value = withSpring(1);
      }
    },
  });

  const animatedContainerStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  const animatedBackdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleClose}
    >
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar barStyle="light-content" />
        
        {/* Backdrop */}
        <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
        
        <PanGestureHandler onGestureEvent={gestureHandler}>
          <Animated.View style={[styles.container, animatedContainerStyle]}>
            {/* Video */}
            <Pressable onPress={handleVideoPress} style={styles.videoContainer}>
              <VideoView
                ref={videoViewRef}
                player={player}
                style={styles.video}
                contentFit="contain"
                nativeControls={false}
              />
            </Pressable>

            {/* Controls overlay */}
            <Animated.View
              style={[styles.controlsOverlay, controlsAnimatedStyle]}
              pointerEvents={showControls ? "auto" : "none"}
            >
              {/* Top bar with close button and drag indicator */}
              <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
                {/* Drag indicator */}
                <View style={styles.dragIndicator} />
                
                {/* Close button */}
                <Pressable onPress={handleClose} style={styles.closeButton}>
                  <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                    <Ionicons name="close" size={24} color="#fff" />
                  </BlurView>
                </Pressable>
              </View>

              {/* Center play/pause button */}
              <Pressable onPress={handlePlayPause} style={styles.centerPlayButton}>
                <BlurView intensity={60} tint="dark" style={styles.playButtonBlur}>
                  <Ionicons
                    name={isPlaying ? "pause" : "play"}
                    size={48}
                    color="#fff"
                    style={isPlaying ? {} : { marginLeft: 4 }}
                  />
                </BlurView>
              </Pressable>

              {/* Bottom controls */}
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }]}>
                {/* Mute button */}
                <Pressable onPress={handleMuteToggle} style={styles.controlButton}>
                  <BlurView intensity={80} tint="dark" style={styles.blurButton}>
                    <Ionicons
                      name={isMuted ? "volume-mute" : "volume-high"}
                      size={24}
                      color="#fff"
                    />
                  </BlurView>
                </Pressable>

                {/* Swipe hint text */}
                <Text style={styles.hintText}>Swipe down to close</Text>

                {/* Spacer for alignment */}
                <View style={{ width: 44 }} />
              </View>
            </Animated.View>
          </Animated.View>
        </PanGestureHandler>
      </GestureHandlerRootView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#000",
  },
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  videoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: "center",
    alignItems: "center",
  },
  video: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
  },
  topBar: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "flex-start",
    paddingHorizontal: 16,
    position: "relative",
  },
  dragIndicator: {
    width: 40,
    height: 5,
    borderRadius: 3,
    backgroundColor: "rgba(255, 255, 255, 0.5)",
    marginBottom: 16,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    top: 50,
  },
  blurButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  centerPlayButton: {
    alignSelf: "center",
  },
  playButtonBlur: {
    width: 80,
    height: 80,
    borderRadius: 40,
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
  },
  bottomBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  controlButton: {
    // Just wraps the blur button
  },
  hintText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    fontWeight: "500",
  },
});

export default FullscreenVideoModal;

