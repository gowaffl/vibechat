import React, { useState, useEffect } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { Play, Pause } from "lucide-react-native";
import * as Haptics from "expo-haptics";

interface VoicePlayerProps {
  voiceUrl: string;
  duration?: number;
  isCurrentUser?: boolean;
}

export const VoicePlayer: React.FC<VoicePlayerProps> = ({ 
  voiceUrl, 
  duration = 0,
  isCurrentUser = false 
}) => {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [totalDuration, setTotalDuration] = useState(duration);

  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const playSound = async () => {
    try {
      if (sound) {
        if (isPlaying) {
          await sound.pauseAsync();
          setIsPlaying(false);
        } else {
          await sound.playAsync();
          setIsPlaying(true);
        }
        Haptics.selectionAsync();
        return;
      }

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: voiceUrl },
        { shouldPlay: true },
        onPlaybackStatusUpdate
      );
      
      setSound(newSound);
      setIsPlaying(true);
      Haptics.selectionAsync();
    } catch (error) {
      console.error("Error playing sound:", error);
    }
  };

  const onPlaybackStatusUpdate = (status: any) => {
    if (status.isLoaded) {
      setPosition(status.positionMillis / 1000);
      setTotalDuration(status.durationMillis ? status.durationMillis / 1000 : duration);
      
      if (status.didJustFinish) {
        setIsPlaying(false);
        setPosition(0);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const progress = totalDuration > 0 ? (position / totalDuration) * 100 : 0;

  return (
    <View style={[
      styles.container,
      isCurrentUser && styles.currentUserContainer
    ]}>
      <Pressable onPress={playSound} style={styles.playButton}>
        {isPlaying ? (
          <Pause size={20} color={isCurrentUser ? "#007AFF" : "#FFFFFF"} fill={isCurrentUser ? "#007AFF" : "#FFFFFF"} />
        ) : (
          <Play size={20} color={isCurrentUser ? "#007AFF" : "#FFFFFF"} fill={isCurrentUser ? "#007AFF" : "#FFFFFF"} />
        )}
      </Pressable>

      <View style={styles.waveformContainer}>
        {/* Simple waveform visualization */}
        <View style={styles.waveform}>
          {[...Array(20)].map((_, i) => (
            <View
              key={i}
              style={[
                styles.waveformBar,
                {
                  height: 8 + Math.random() * 16,
                  backgroundColor: i < (progress / 5) 
                    ? (isCurrentUser ? "#007AFF" : "#FFFFFF")
                    : (isCurrentUser ? "rgba(0, 122, 255, 0.3)" : "rgba(255, 255, 255, 0.3)"),
                },
              ]}
            />
          ))}
        </View>
        <Text style={[styles.durationText, isCurrentUser && styles.currentUserText]}>
          {formatTime(isPlaying ? position : totalDuration)}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    gap: 12,
    minWidth: 200,
  },
  currentUserContainer: {
    // Specific styles for current user
  },
  playButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  waveformContainer: {
    flex: 1,
    gap: 4,
  },
  waveform: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    height: 24,
  },
  waveformBar: {
    flex: 1,
    borderRadius: 2,
  },
  durationText: {
    fontSize: 12,
    color: "#FFFFFF",
    opacity: 0.7,
  },
  currentUserText: {
    color: "#007AFF",
  },
});

