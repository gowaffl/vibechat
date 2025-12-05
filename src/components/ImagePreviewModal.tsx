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
  TouchableOpacity,
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
  withRepeat,
  Easing,
  interpolate,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import LiquidGlassButton from "./LiquidGlass/LiquidGlassButton";

// Shimmer Loading Component
const ShimmerLoader: React.FC = () => {
  const shimmerValue = useSharedValue(0);

  useEffect(() => {
    shimmerValue.value = withRepeat(
      withTiming(1, { duration: 1500, easing: Easing.inOut(Easing.ease) }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerValue.value,
      [0, 1],
      [-SCREEN_WIDTH, SCREEN_WIDTH]
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <View style={shimmerStyles.container}>
      {/* Background placeholder */}
      <View style={shimmerStyles.placeholder}>
        {/* Animated shimmer gradient */}
        <Animated.View style={[shimmerStyles.shimmer, shimmerStyle]}>
          <LinearGradient
            colors={[
              'transparent',
              'rgba(255, 255, 255, 0.08)',
              'rgba(255, 255, 255, 0.15)',
              'rgba(255, 255, 255, 0.08)',
              'transparent',
            ]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
      </View>
      
      {/* Loading indicator and text */}
      <View style={shimmerStyles.loadingContent}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={shimmerStyles.loadingText}>Creating your masterpiece...</Text>
        <Text style={shimmerStyles.loadingSubtext}>This may take a moment</Text>
      </View>
    </View>
  );
};

const shimmerStyles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  placeholder: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
  },
  shimmer: {
    ...StyleSheet.absoluteFillObject,
    width: SCREEN_WIDTH * 2,
  },
  loadingContent: {
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 8,
  },
  loadingSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
  },
});

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

interface ImagePreviewModalProps {
  visible: boolean;
  imageUrl: string | null;
  initialPrompt: string;
  defaultCaption?: string;
  onAccept: (caption: string) => void;
  onEdit: (prompt: string) => void;
  onCancel: () => void;
  isProcessing: boolean;
  previewType: "image" | "meme" | "remix";
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUrl,
  initialPrompt,
  defaultCaption = "",
  onAccept,
  onEdit,
  onCancel,
  isProcessing,
  previewType,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [finalCaption, setFinalCaption] = useState("");
  const [localProcessing, setLocalProcessing] = useState(false);

  const slideAnim = useSharedValue(SCREEN_HEIGHT);
  const opacityAnim = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, { damping: 20, stiffness: 90 });
      opacityAnim.value = withTiming(1, { duration: 300 });
      setEditPrompt("");
      setFinalCaption(defaultCaption);
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 200 });
      opacityAnim.value = withTiming(0, { duration: 200 });
      setIsEditing(false);
      setIsFinalizing(false);
      setLocalProcessing(false);
    }
  }, [visible, defaultCaption]);

  // Sync external processing state
  useEffect(() => {
    setLocalProcessing(isProcessing);
  }, [isProcessing]);

  const handleAccept = () => {
    setIsFinalizing(true);
  };

  const handleFinalize = () => {
    onAccept(finalCaption);
    setIsFinalizing(false);
    Keyboard.dismiss();
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
                <ShimmerLoader />
              )}
              
              {localProcessing && imageUrl && (
                <View style={styles.loadingOverlay}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <ActivityIndicator size="large" color="#007AFF" />
                  <Text style={styles.loadingText}>Refining...</Text>
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
                    <TouchableOpacity 
                      onPress={() => setIsEditing(false)}
                      activeOpacity={0.7}
                      style={[styles.actionButton, styles.cancelButton]}
                    >
                      <Text style={styles.buttonText}>Cancel</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={handleEditSubmit}
                      activeOpacity={0.7}
                      disabled={!editPrompt.trim()}
                      style={[styles.actionButton, styles.updateButton, !editPrompt.trim() && styles.disabledButton]}
                    >
                      <Text style={styles.buttonText}>Update</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : isFinalizing ? (
                <View style={styles.editContainer}>
                  <Text style={styles.helperText}>Add a caption (optional):</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Enter a caption..."
                    placeholderTextColor="rgba(255,255,255,0.5)"
                    value={finalCaption}
                    onChangeText={setFinalCaption}
                    autoFocus
                    multiline
                    returnKeyType="default"
                  />
                  <View style={styles.editButtons}>
                    <TouchableOpacity 
                      onPress={() => setIsFinalizing(false)}
                      activeOpacity={0.7}
                      style={[styles.actionButton, styles.cancelButton]}
                    >
                      <Text style={styles.buttonText}>Back</Text>
                    </TouchableOpacity>
                    
                    <TouchableOpacity 
                      onPress={handleFinalize}
                      activeOpacity={0.7}
                      style={[styles.actionButton, styles.updateButton]}
                    >
                      <Text style={styles.buttonText}>Send</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <View style={styles.actionButtons}>
                  {/* Reject / Cancel - always enabled so user can cancel during generation */}
                  <TouchableOpacity onPress={onCancel} activeOpacity={0.7}>
                    <View style={[styles.iconButton, styles.rejectButton]}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                      <X size={28} color="#FF453A" />
                    </View>
                  </TouchableOpacity>
                  
                  {/* Edit - disabled while loading */}
                  <TouchableOpacity 
                    onPress={() => setIsEditing(true)} 
                    activeOpacity={0.7}
                    disabled={!imageUrl}
                  >
                    <View style={[styles.iconButton, !imageUrl && styles.disabledIconButton]}>
                      <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
                      <Edit2 size={28} color={imageUrl ? "#FFF" : "rgba(255,255,255,0.3)"} />
                    </View>
                  </TouchableOpacity>

                  {/* Accept / Send - disabled while loading */}
                  <TouchableOpacity 
                    onPress={handleAccept} 
                    activeOpacity={0.7}
                    disabled={!imageUrl}
                  >
                    <View style={[styles.iconButton, styles.acceptButton, !imageUrl && styles.disabledAcceptButton]}>
                      <Send size={28} color="#FFF" fill="white" />
                    </View>
                  </TouchableOpacity>
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
    justifyContent: "space-evenly",
    alignItems: "center",
    paddingHorizontal: 20,
    width: "100%",
  },
  iconButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  rejectButton: {
    borderColor: "rgba(255, 69, 58, 0.3)",
    backgroundColor: "rgba(255, 69, 58, 0.15)",
  },
  acceptButton: {
    backgroundColor: "#007AFF",
    borderColor: "#007AFF",
    width: 70, // Slightly larger for primary action
    height: 70,
    borderRadius: 35,
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  disabledIconButton: {
    opacity: 0.4,
  },
  disabledAcceptButton: {
    backgroundColor: "rgba(0, 122, 255, 0.3)",
    borderColor: "rgba(0, 122, 255, 0.3)",
    shadowOpacity: 0,
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
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 25,
    justifyContent: "center",
    alignItems: "center",
  },
  cancelButton: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  updateButton: {
    backgroundColor: "#007AFF",
  },
  disabledButton: {
    opacity: 0.5,
  },
  buttonText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
});

