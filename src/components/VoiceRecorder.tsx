import React, { useState, useRef } from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Audio } from "expo-av";
import { Mic, X, Send } from "lucide-react-native";
import * as Haptics from "expo-haptics";

interface VoiceRecorderProps {
  onSend: (voiceUri: string, duration: number) => void;
  onCancel: () => void;
}

export const VoiceRecorder: React.FC<VoiceRecorderProps> = ({ onSend, onCancel }) => {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [duration, setDuration] = useState(0);
  const durationInterval = useRef<NodeJS.Timeout | null>(null);

  const startRecording = async () => {
    try {
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      setRecording(recording);
      setDuration(0);
      
      // Start duration counter
      durationInterval.current = setInterval(() => {
        setDuration((prev) => prev + 1);
      }, 1000);
      
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (err) {
      console.error("Failed to start recording", err);
    }
  };

  const stopRecording = async () => {
    if (!recording) return;

    try {
      await recording.stopAndUnloadAsync();
      const uri = recording.getURI();
      
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }

      if (uri) {
        onSend(uri, duration);
      }
      
      setRecording(null);
      setDuration(0);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (err) {
      console.error("Failed to stop recording", err);
    }
  };

  const cancelRecording = async () => {
    if (recording) {
      await recording.stopAndUnloadAsync();
      setRecording(null);
    }
    
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    
    setDuration(0);
    onCancel();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  React.useEffect(() => {
    if (!recording) {
      startRecording();
    }
    
    return () => {
      if (durationInterval.current) {
        clearInterval(durationInterval.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <View style={styles.container}>
      <Pressable onPress={cancelRecording} style={styles.cancelButton}>
        <X size={24} color="#FF3B30" />
      </Pressable>

      <View style={styles.recordingInfo}>
        <View style={styles.recordingDot} />
        <Text style={styles.durationText}>{formatDuration(duration)}</Text>
      </View>

      <Pressable onPress={stopRecording} style={styles.sendButton}>
        <Send size={24} color="#007AFF" />
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "rgba(28, 28, 30, 0.95)",
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cancelButton: {
    padding: 8,
  },
  recordingInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  recordingDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: "#FF3B30",
  },
  durationText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  sendButton: {
    padding: 8,
  },
});

