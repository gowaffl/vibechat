import React, { useState, useRef, useEffect } from "react";
import {
  View,
  Modal,
  Image,
  Text,
  Dimensions,
  StyleSheet,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  TouchableWithoutFeedback,
  ActivityIndicator
} from "react-native";
import { BlurView } from "expo-blur";
import { X, Check, Edit2, Trash2, Send } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import LiquidGlassButton from "./LiquidGlass/LiquidGlassButton";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl: string | null;
  initialPrompt: string;
  onAccept: () => void;
  onEdit: (prompt: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  previewType: "image" | "meme" | "remix";
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUrl,
  initialPrompt,
  onAccept,
  onEdit,
  onCancel,
  isProcessing,
  previewType,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [localProcessing, setLocalProcessing] = useState(false);

  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 90 });
      opacityAnim.value = withTiming(1, { duration: 300 });
      setEditPrompt(initialPrompt); // Pre-fill with used prompt, or empty? "Submit a follow-up prompt" implies refinement. 
      // If refining, maybe better to start empty or "Make it darker"? 
      // Requirement: "submit a follow-up prompt to try to tweak and dial in the image"
      // So user types "make it blue" -> API needs "Edit this image... make it blue".
      // So we just capture the NEW instruction here.
      setEditPrompt("");
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      opacityAnim.value = withTiming(0, { duration: 200 });
      setIsEditing(false);
      setLocalProcessing(false);
    }
  }, [visible, initialPrompt]);

  // Sync external processing state
  useEffect(() => {
    setLocalProcessing(isProcessing);
  }, [isProcessing]);

  const handleAccept = () => {
    onAccept();
  };

  const handleEditSubmit = () => {
    if (!editPrompt.trim()) return;
    onEdit(editPrompt);
    setEditPrompt("");
    setIsEditing(false);
    Keyboard.dismiss();
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacityAnim.value,
  }));

  const modalContentStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: slideAnim.value }],
  }));

  if (!visible && opacityAnim.value === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent
      statusBarTranslucent
      animationType="none"
      onRequestClose={onCancel}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <Animated.View style={[styles.container, containerStyle]}>
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {previewType === "meme" ? "Meme Preview" : previewType === "remix" ? "Remix Preview" : "Image Preview"}
            </Text>
            <LiquidGlassButton
              onPress={onCancel}
              variant="ghost"
              size="small"
              style={{ width: 40, height: 40, paddingHorizontal: 0, paddingVertical: 0 }}
            >
              <X size={20} color="#FFF" />
            </LiquidGlassButton>
          </View>

          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.contentContainer}
          >
            {/* Image Container */}
            <View style={styles.imageContainer}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.image}
                  resizeMode="contain"
                />
              ) : (
                <View style={[styles.image, { justifyContent: 'center', alignItems: 'center' }]}>
                   <ActivityIndicator size="large" color="#FFF" />
                </View>
              )}
              
              {localProcessing && (
                <View style={styles.loadingOverlay}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <ActivityIndicator size="large" color="#0061FF" />
                  <Text style={styles.loadingText}>Generating...</Text>
                </View>
              )}
            </View>

            {/* Controls */}
            <Animated.View style={[styles.controlsContainer, modalContentStyle]}>
              {isEditing ? (
                <View style={styles.editContainer}>
                  <Text style={styles.helperText}>Describe how you want to change this image:</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Make it cyberpunk, add a cat, etc..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={editPrompt}
                    onChangeText={setEditPrompt}
                    autoFocus
                    returnKeyType="send"
                    onSubmitEditing={handleEditSubmit}
                  />
                  <View style={styles.editButtons}>
                    <LiquidGlassButton
                      onPress={() => setIsEditing(false)}
                      variant="secondary"
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </LiquidGlassButton>
                    <LiquidGlassButton
                      onPress={handleEditSubmit}
                      variant="primary"
                      style={{ flex: 1 }}
                      disabled={!editPrompt.trim()}
                    >
                      Update
                    </LiquidGlassButton>
                  </View>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  <LiquidGlassButton
                    onPress={onCancel}
                    variant="secondary" // Use secondary/ghost for "Discard"/Cancel to distinguish
                    style={{ flex: 1, backgroundColor: 'rgba(255, 59, 48, 0.2)', borderColor: 'rgba(255, 59, 48, 0.3)' }}
                    icon={<Trash2 size={18} color="#FF3B30" />}
                  >
                    Discard
                  </LiquidGlassButton>
                  
                  <LiquidGlassButton
                    onPress={() => setIsEditing(true)}
                    variant="secondary"
                    style={{ flex: 1 }}
                    icon={<Edit2 size={18} color="#FFF" />}
                  >
                    Edit
                  </LiquidGlassButton>

                  <LiquidGlassButton
                    onPress={handleAccept}
                    variant="primary"
                    style={{ flex: 1.5 }}
                    icon={<Send size={18} color="#FFF" />}
                  >
                    Send
                  </LiquidGlassButton>
                </View>
              )}
            </Animated.View>
          </KeyboardAvoidingView>
        </Animated.View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: Platform.OS === "ios" ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 10,
    zIndex: 10,
  },
  title: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "600",
  },
  contentContainer: {
    flex: 1,
    justifyContent: "center",
  },
  imageContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 20,
  },
  image: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH, // Square aspect ratio default
    backgroundColor: "#1a1a1a",
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  loadingText: {
    color: "#FFF",
    marginTop: 10,
    fontWeight: "500",
  },
  controlsContainer: {
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 40 : 20,
    backgroundColor: "rgba(20,20,20,0.8)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  editContainer: {
    gap: 12,
  },
  helperText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 16,
    color: "#FFF",
    fontSize: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  editButtons: {
    flexDirection: "row",
    gap: 12,
    marginTop: 8,
  },
});

