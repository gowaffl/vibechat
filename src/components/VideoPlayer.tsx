import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Pressable,
  Dimensions,
  StyleSheet,
  ActivityIndicator,
  Image,
  Text,
} from "react-native";
import { useVideoPlayer, VideoView, type VideoView as VideoViewType } from "expo-video";
import { useEvent } from "expo";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { FullscreenVideoModal } from "./FullscreenVideoModal";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const MAX_VIDEO_WIDTH = Math.min(SCREEN_WIDTH * 0.75, 280);
const VIDEO_HEIGHT = 200;

interface VideoPlayerProps {
  videoUrl: string;
  thumbnailUrl?: string | null;
  duration?: number; // in seconds
  containerWidth?: number;
  borderRadius?: number;
  onFullscreenPress?: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  videoUrl,
  thumbnailUrl,
  duration,
  containerWidth = MAX_VIDEO_WIDTH,
  borderRadius = 16,
  onFullscreenPress,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [showThumbnail, setShowThumbnail] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const videoViewRef = useRef<VideoViewType>(null);
  
  const controlsOpacity = useSharedValue(1);

  // Initialize video player
  const player = useVideoPlayer(videoUrl, (player) => {
    player.loop = false;
    player.muted = true;
  });

  // Subscribe to player events
  const { isPlaying: playerIsPlaying } = useEvent(player, "playingChange", {
    isPlaying: player.playing,
  });

  const { status } = useEvent(player, "statusChange", {
    status: player.status,
  });

  // Sync playing state
  useEffect(() => {
    setIsPlaying(playerIsPlaying);
  }, [playerIsPlaying]);

  // Handle status changes
  useEffect(() => {
    if (status === "loading") {
      setIsLoading(true);
      setHasError(false);
    } else if (status === "readyToPlay") {
      setIsLoading(false);
      setHasError(false);
    } else if (status === "error") {
      setIsLoading(false);
      setHasError(true);
    } else {
      setIsLoading(false);
    }
  }, [status]);

  // Auto-hide controls after 3 seconds of playback
  useEffect(() => {
    if (isPlaying && showControls) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
        controlsOpacity.value = withTiming(0, { duration: 200 });
      }, 3000);
    }

    return () => {
      if (controlsTimeoutRef.current) {
        clearTimeout(controlsTimeoutRef.current);
      }
    };
  }, [isPlaying, showControls]);

  const handlePlayPause = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    if (showThumbnail) {
      setShowThumbnail(false);
    }
    
    if (isPlaying) {
      player.pause();
    } else {
      player.play();
    }
    
    // Show controls when toggling play/pause
    setShowControls(true);
    controlsOpacity.value = withSpring(1);
  }, [isPlaying, player, showThumbnail]);

  const handleMuteToggle = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newMuted = !isMuted;
    setIsMuted(newMuted);
    player.muted = newMuted;
  }, [isMuted, player]);

  const handleVideoPress = useCallback(() => {
    // Toggle controls visibility
    const newShowControls = !showControls;
    setShowControls(newShowControls);
    controlsOpacity.value = withTiming(newShowControls ? 1 : 0, { duration: 200 });
    
    // Reset auto-hide timer
    if (controlsTimeoutRef.current) {
      clearTimeout(controlsTimeoutRef.current);
    }
  }, [showControls]);

  const handleFullscreen = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onFullscreenPress) {
      onFullscreenPress();
    } else {
      // Pause the inline player and open fullscreen modal
      player.pause();
      setIsFullscreen(true);
    }
  }, [onFullscreenPress, player]);

  const handleCloseFullscreen = useCallback(() => {
    setIsFullscreen(false);
    // Resume playing if it was playing before
    if (isPlaying) {
      player.play();
    }
  }, [isPlaying, player]);

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  // Format duration for display
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={[styles.container, { width: containerWidth, borderRadius }]}>
      {/* Thumbnail overlay (shown before first play) */}
      {showThumbnail && thumbnailUrl && (
        <Animated.View
          entering={FadeIn.duration(200)}
          exiting={FadeOut.duration(200)}
          style={[StyleSheet.absoluteFill, styles.thumbnailContainer, { borderRadius }]}
          pointerEvents="none"
        >
          <Image
            source={{ uri: thumbnailUrl }}
            style={[styles.thumbnail, { borderRadius }]}
            resizeMode="cover"
          />
        </Animated.View>
      )}

      {/* Video View */}
      <Pressable onPress={handleVideoPress} style={styles.videoContainer}>
        <VideoView
          ref={videoViewRef}
          player={player}
          style={[styles.video, { borderRadius }]}
          contentFit="cover"
          nativeControls={false}
        />
      </Pressable>

      {/* Loading indicator */}
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      {/* Error state */}
      {hasError && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={32} color="#fff" />
          <Text style={styles.errorText}>Video unavailable</Text>
        </View>
      )}

      {/* Controls overlay */}
      <Animated.View
        style={[styles.controlsOverlay, controlsAnimatedStyle]}
        pointerEvents={showControls ? "auto" : "none"}
      >
        {/* Center play/pause button */}
        <AnimatedPressable
          onPress={handlePlayPause}
          style={styles.centerPlayButton}
        >
          <View style={styles.playButtonBackground}>
            <Ionicons
              name={isPlaying ? "pause" : "play"}
              size={32}
              color="#fff"
              style={isPlaying ? {} : { marginLeft: 3 }}
            />
          </View>
        </AnimatedPressable>

        {/* Bottom controls bar */}
        <View style={styles.bottomControls}>
          {/* Mute button */}
          <Pressable onPress={handleMuteToggle} style={styles.controlButton}>
            <Ionicons
              name={isMuted ? "volume-mute" : "volume-high"}
              size={20}
              color="#fff"
            />
          </Pressable>

          {/* Duration badge */}
          {duration !== undefined && duration > 0 && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationText}>{formatDuration(duration)}</Text>
            </View>
          )}

          {/* Fullscreen button */}
          <Pressable onPress={handleFullscreen} style={styles.controlButton}>
            <Ionicons name="expand" size={20} color="#fff" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Video type indicator */}
      <View style={styles.videoIndicator}>
        <Ionicons name="videocam" size={12} color="#fff" />
      </View>

      {/* Fullscreen Modal */}
      <FullscreenVideoModal
        visible={isFullscreen}
        videoUrl={videoUrl}
        onClose={handleCloseFullscreen}
        initialMuted={isMuted}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    height: VIDEO_HEIGHT,
    backgroundColor: "#000",
    overflow: "hidden",
    position: "relative",
  },
  videoContainer: {
    flex: 1,
  },
  video: {
    flex: 1,
    backgroundColor: "#000",
  },
  thumbnailContainer: {
    zIndex: 10,
    backgroundColor: "#000",
  },
  thumbnail: {
    width: "100%",
    height: "100%",
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  errorContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0, 0, 0, 0.7)",
  },
  errorText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
    fontFamily: "System",
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 20,
  },
  centerPlayButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  playButtonBackground: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    justifyContent: "center",
    alignItems: "center",
    backdropFilter: "blur(10px)",
  },
  bottomControls: {
    position: "absolute",
    bottom: 8,
    left: 8,
    right: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  controlButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  durationBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
  },
  durationText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    fontFamily: "System",
  },
  videoIndicator: {
    position: "absolute",
    top: 8,
    left: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
});

export default VideoPlayer;

