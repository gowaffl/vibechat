import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Image } from "expo-image";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  Platform,
  Keyboard,
  BackHandler,
} from "react-native";
import { BottomSheetModal, BottomSheetView, BottomSheetTextInput, useBottomSheetModal } from "@gorhom/bottom-sheet";
import { BlurView } from "expo-blur";
import { X, Edit2, Send, Wand2, RefreshCw } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  Easing,
  interpolate,
  runOnJS,
  FadeIn,
  FadeOut,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// --- Shimmer Animations ---

const useShimmerAnimation = () => {
  const shimmerProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, {
        duration: 1500,
        easing: Easing.linear,
      }),
      -1,
      false
    );
  }, []);

  const shimmerStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerProgress.value,
      [0, 1],
      [-SCREEN_WIDTH, SCREEN_WIDTH]
    );
    return {
      transform: [{ translateX }],
    };
  });

  return { shimmerStyle };
};

import { ShimmeringText } from "@/components/ShimmeringText";

// Loading Text Component (ChatGPT style)
const LoadingText = ({ text = "Generating image..." }: { text?: string }) => {
  const { colors, isDark } = useTheme();
  return (
    <View style={{ overflow: 'hidden', flexDirection: 'row', alignItems: 'center' }}>
       <ShimmeringText 
           text={text}
           style={{
             fontSize: 14,
             fontWeight: '600',
             color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
           }}
           shimmerColor={isDark ? "rgba(255, 255, 255, 0.9)" : "rgba(0, 0, 0, 0.9)"}
           duration={1200}
        />
    </View>
  );
};

// Shimmer Loader for Image Container
const ShimmerImageLoader = () => {
  const { shimmerStyle } = useShimmerAnimation();
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.shimmerContainer}>
      <LinearGradient
        colors={isDark ? ['#1a1a1a', '#222', '#1a1a1a'] : ['#f0f0f0', '#ffffff', '#f0f0f0']}
        style={StyleSheet.absoluteFill}
      />
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={isDark 
            ? ['transparent', 'rgba(255, 255, 255, 0.05)', 'transparent']
            : ['transparent', 'rgba(0, 0, 0, 0.05)', 'transparent']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{ width: SCREEN_WIDTH, height: '100%' }}
        />
      </Animated.View>
      <View style={styles.centerContent}>
        <ShimmeringText 
           text="Creating your masterpiece..."
           style={[styles.loadingText, { color: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)' }]}
           shimmerColor={isDark ? "#FFFFFF" : "#000000"}
           duration={1200}
        />
      </View>
    </View>
  );
};

interface ImageGeneratorSheetProps {
  isVisible: boolean;
  onClose: () => void; // Explicit Cancel (X button or Finalize)
  onMinimize: () => void; // Swipe down to dock
  imageUrl: string | null;
  isProcessing: boolean;
  onAccept: (caption: string) => void;
  onEdit: (prompt: string) => void;
  initialPrompt?: string;
}

// --- Docked Pill Component (Exported for ChatScreen) ---
export const ImageGenerationPill = ({ 
  onPress, 
  isProcessing, 
  isVisible,
  style
}: { 
  onPress: () => void; 
  isProcessing: boolean;
  isVisible: boolean;
  style?: any;
}) => {
  const { colors, isDark } = useTheme();

  if (!isVisible) return null;

  return (
    <Animated.View 
      entering={FadeIn.duration(300)} 
      exiting={FadeOut.duration(300)} 
      style={[styles.dockedWrapper, style]}
    >
      <TouchableOpacity 
        style={[styles.pillContainer, { 
          backgroundColor: isDark ? 'rgba(20,20,20,0.9)' : 'rgba(255,255,255,0.9)',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
          shadowColor: isDark ? "#000" : "#000",
        }]}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <BlurView intensity={30} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
        <View style={styles.pillContent}>
          {isProcessing ? (
            <LoadingText text="Generating..." />
          ) : (
            <View style={styles.readyContainer}>
              <Wand2 size={16} color={colors.primary} style={{ marginRight: 8 }} />
              <Text style={[styles.readyText, { color: colors.text }]}>Image Ready • Tap to view</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
};

export const ImageGeneratorSheet: React.FC<ImageGeneratorSheetProps> = ({
  isVisible,
  onClose,
  onMinimize,
  imageUrl,
  isProcessing,
  onAccept,
  onEdit,
  initialPrompt = "",
}) => {
  const bottomSheetRef = useRef<BottomSheetModal>(null);
  const { colors, isDark } = useTheme();
  
  // Snap points: Only expanded (95% to show more content)
  const snapPoints = useMemo(() => ['95%'], []);
  
  // State for editing/captioning
  const [isEditing, setIsEditing] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [editPrompt, setEditPrompt] = useState("");
  const [finalCaption, setFinalCaption] = useState("");

  // Handle visibility changes
  useEffect(() => {
    if (isVisible) {
      bottomSheetRef.current?.present();
    } else {
      bottomSheetRef.current?.dismiss();
    }
  }, [isVisible]);

  const handleEditSubmit = () => {
    if (!editPrompt.trim()) return;
    onEdit(editPrompt);
    setEditPrompt("");
    setIsEditing(false);
    Keyboard.dismiss();
  };

  const handleFinalize = () => {
    onAccept(finalCaption);
    setFinalCaption("");
    setIsFinalizing(false);
    Keyboard.dismiss();
    onClose(); 
  };
  
  // Handle dismissal (swipe down)
  const handleDismiss = useCallback(() => {
    // Only trigger minimize if we are supposed to be visible
    // If isVisible is false, it means parent closed us, so no need to minimize
    if (isVisible) {
      onMinimize();
    }
  }, [isVisible, onMinimize]);

  // --- Render Expanded Content ---
  const renderContent = () => {
    return (
      <View style={styles.expandedContainer}>
        {/* Floating Image Container (Separate Look) */}
        <View style={[styles.imageCardContainer, { 
          backgroundColor: isDark ? '#000' : '#f5f5f5',
          borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
        }]}>
          <BlurView intensity={20} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={styles.previewImage}
              contentFit="contain"
              transition={200}
            />
          ) : (
            <ShimmerImageLoader />
          )}
          
          {/* Overlay for "Refining..." state if image exists but processing again */}
          {imageUrl && isProcessing && (
            <View style={[styles.overlayContainer, { backgroundColor: isDark ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.6)' }]}>
               <BlurView intensity={10} tint={colors.blurTint} style={StyleSheet.absoluteFill} />
               <LoadingText text="Refining..." />
            </View>
          )}
        </View>

        {/* Controls Section */}
        <View style={styles.controlsSection}>
          {isEditing ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.inputModeContainer}>
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>How should we change this?</Text>
              <BottomSheetTextInput
                style={[styles.input, { 
                  backgroundColor: colors.inputBackground, 
                  color: colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                }]}
                placeholder="Make it cyberpunk, add a cat..."
                placeholderTextColor={colors.inputPlaceholder}
                value={editPrompt}
                onChangeText={setEditPrompt}
                returnKeyType="send"
                onSubmitEditing={handleEditSubmit}
              />
              <View style={styles.rowButtons}>
                 <TouchableOpacity 
                   style={[styles.secondaryButton, { 
                     backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                     borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                   }]} 
                   onPress={() => setIsEditing(false)}
                 >
                   <Text style={[styles.buttonText, { color: colors.text }]}>Cancel</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                    style={[styles.primaryButton, { backgroundColor: colors.primary }, !editPrompt.trim() && styles.disabledButton]} 
                    onPress={handleEditSubmit}
                    disabled={!editPrompt.trim()}
                 >
                   <Text style={styles.buttonText}>Update</Text>
                 </TouchableOpacity>
              </View>
            </Animated.View>
          ) : isFinalizing ? (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.inputModeContainer}>
              <Text style={[styles.helperText, { color: colors.textSecondary }]}>Add a caption (optional)</Text>
              <BottomSheetTextInput
                style={[styles.input, { 
                  backgroundColor: colors.inputBackground, 
                  color: colors.text,
                  borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.1)',
                }]}
                placeholder="Type a caption..."
                placeholderTextColor={colors.inputPlaceholder}
                value={finalCaption}
                onChangeText={setFinalCaption}
                returnKeyType="send"
                onSubmitEditing={handleFinalize}
              />
              <View style={styles.rowButtons}>
                 <TouchableOpacity 
                   style={[styles.secondaryButton, { 
                     backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                     borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                   }]} 
                   onPress={() => setIsFinalizing(false)}
                 >
                   <Text style={[styles.buttonText, { color: colors.text }]}>Back</Text>
                 </TouchableOpacity>
                 <TouchableOpacity style={[styles.primaryButton, { backgroundColor: colors.primary }]} onPress={handleFinalize}>
                   <Text style={styles.buttonText}>Send</Text>
                 </TouchableOpacity>
              </View>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeIn} exiting={FadeOut} style={styles.actionButtonsContainer}>
              {/* Cancel (Minimize) */}
              <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                <View style={[styles.iconCircle, { 
                  backgroundColor: isDark ? 'rgba(255, 69, 58, 0.15)' : 'rgba(255, 69, 58, 0.1)',
                  borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                }]}>
                  <X size={24} color="#FF453A" />
                </View>
                <Text style={[styles.iconLabel, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>

              {/* Edit */}
              <TouchableOpacity 
                onPress={() => setIsEditing(true)} 
                disabled={!imageUrl || isProcessing}
                style={[styles.iconButton, (!imageUrl || isProcessing) && styles.disabledOpacity]}
              >
                <View style={[styles.iconCircle, {
                   backgroundColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)',
                   borderColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                }]}>
                  <Edit2 size={24} color={colors.text} />
                </View>
                <Text style={[styles.iconLabel, { color: colors.textSecondary }]}>Edit</Text>
              </TouchableOpacity>

              {/* Send */}
              <TouchableOpacity 
                onPress={() => setIsFinalizing(true)}
                disabled={!imageUrl || isProcessing}
                style={[styles.iconButton, (!imageUrl || isProcessing) && styles.disabledOpacity]}
              >
                <View style={[styles.iconCircle, styles.sendCircle, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                  <Send size={24} color="#FFF" fill="white" />
                </View>
                <Text style={[styles.iconLabel, { color: colors.textSecondary }]}>Send</Text>
              </TouchableOpacity>
            </Animated.View>
          )}
        </View>
      </View>
    );
  };

  return (
    <BottomSheetModal
      ref={bottomSheetRef}
      snapPoints={snapPoints}
      index={0}
      onDismiss={handleDismiss}
      enablePanDownToClose={true} 
      backgroundStyle={[styles.sheetBackground, { 
        backgroundColor: isDark ? '#050505' : colors.background,
        shadowColor: colors.glassShadow,
      }]}
      handleIndicatorStyle={[styles.handleIndicator, { 
        backgroundColor: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)' 
      }]}
      keyboardBehavior="interactive"
      android_keyboardInputMode="adjustResize"
      enableDismissOnClose={true}
    >
      <BottomSheetView style={[styles.contentContainer, { flex: 1 }]}>
        {renderContent()}
      </BottomSheetView>
    </BottomSheetModal>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: '#050505',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -5 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 20,
  },
  handleIndicator: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    width: 40,
  },
  contentContainer: {
    flex: 1,
    paddingTop: 10,
    paddingBottom: 10,
  },
  // Docked Pill Styles (Floating)
  dockedWrapper: {
    position: 'absolute',
    bottom: 80, // Approximate height above input, will be overridden by parent
    alignSelf: 'center',
    zIndex: 1000,
  },
  pillContainer: {
    width: 250,
    height: 50,
    borderRadius: 25,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(20,20,20,0.9)',
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  pillContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  loadingText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  readyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  readyText: {
    color: '#FFF',
    fontSize: 15,
    fontWeight: '600',
  },
  // Expanded Styles
  expandedContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  imageCardContainer: {
    aspectRatio: 1, // Square container that matches most AI-generated images
    width: '100%',
    marginBottom: 20,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: '#000',
    // Depth
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  shimmerContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  centerContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Controls
  controlsSection: {
    paddingTop: 10,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingBottom: 20,
  },
  iconButton: {
    alignItems: 'center',
    gap: 8,
  },
  iconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sendCircle: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
    shadowColor: "#007AFF",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  iconLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    fontWeight: '500',
  },
  disabledOpacity: {
    opacity: 0.5,
  },
  // Input Modes
  inputModeContainer: {
    gap: 12,
  },
  helperText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    marginLeft: 4,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  rowButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  primaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: '#007AFF',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryButton: {
    flex: 1,
    height: 50,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  disabledButton: {
    opacity: 0.5,
    backgroundColor: 'rgba(0,122,255,0.3)',
  },
  buttonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
