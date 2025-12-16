import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Dimensions,
  StyleSheet,
  Image,
  SafeAreaView,
  Platform,
  ActivityIndicator,
} from "react-native";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useRoomContext,
} from "@livekit/react-native";
import { Track } from "livekit-client";
import { Mic, MicOff, PhoneOff, Volume2, Maximize2, Minimize2, X, ChevronDown } from "lucide-react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Extrapolate,
  runOnJS,
  useAnimatedGestureHandler,
} from "react-native-reanimated";
import { PanGestureHandler } from "react-native-gesture-handler";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useUser } from "@/contexts/UserContext";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Constants matching ImagePreviewModal for consistent feel
const DOCKED_HEIGHT = 90;
const FULL_HEIGHT = SCREEN_HEIGHT;
const SPRING_CONFIG = { damping: 20, stiffness: 90 };

interface VoiceRoomModalProps {
  visible: boolean;
  token: string;
  serverUrl: string;
  roomName: string;
  onLeave: () => void;
  isConnecting?: boolean;
}

export const VoiceRoomModal: React.FC<VoiceRoomModalProps> = ({
  visible,
  token,
  serverUrl,
  roomName,
  onLeave,
  isConnecting = false,
}) => {
  const [isDocked, setIsDocked] = useState(false);
  const insets = useSafeAreaInsets();
  
  // 0 = Expanded (Fullscreen), 1 = Docked (Bottom Pill)
  const dockProgress = useSharedValue(0);
  
  // Slide animation for initial mount/unmount
  const slideAnim = useSharedValue(SCREEN_HEIGHT);

  useEffect(() => {
    if (visible) {
      slideAnim.value = withSpring(0, SPRING_CONFIG);
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      // Reset dock state when closed
      setIsDocked(false);
      dockProgress.value = 0;
    }
  }, [visible]);

  // Worklet friendly toggle handler
  const handleDockToggle = useCallback((shouldDock: boolean) => {
    setIsDocked(shouldDock);
  }, []);

  const onGestureEvent = useAnimatedGestureHandler({
    onStart: (_, ctx: any) => {
      ctx.startY = dockProgress.value;
    },
    onActive: (event, ctx) => {
      // Swipe down to dock: 0 -> 1
      // If expanded (0), swiping down increases Y
      // Map translationY to progress (approx 300px swipe to fully dock)
      if (!isDocked) {
          const progress = ctx.startY + event.translationY / 300;
          dockProgress.value = Math.max(0, Math.min(1, progress));
      } else {
          // If docked (1), swiping up decreases Y
          const progress = ctx.startY + event.translationY / 300;
          dockProgress.value = Math.max(0, Math.min(1, progress));
      }
    },
    onEnd: (event) => {
      if (!isDocked) {
        // If swiped down enough or flicked down, dock it
        if (event.translationY > 100 || event.velocityY > 500) {
           dockProgress.value = withSpring(1, SPRING_CONFIG);
           runOnJS(handleDockToggle)(true);
        } else {
           dockProgress.value = withSpring(0, SPRING_CONFIG);
        }
      } else {
        // If swiped up enough or flicked up, expand it
        if (event.translationY < -50 || event.velocityY < -500) {
           dockProgress.value = withSpring(0, SPRING_CONFIG);
           runOnJS(handleDockToggle)(false);
        } else {
           dockProgress.value = withSpring(1, SPRING_CONFIG);
        }
      }
    },
  }, [isDocked]);

  const toggleDock = () => {
    const nextState = !isDocked;
    setIsDocked(nextState);
    dockProgress.value = withSpring(nextState ? 1 : 0, SPRING_CONFIG);
  };

  const containerStyle = useAnimatedStyle(() => {
    // Height Interpolation
    const currentHeight = interpolate(
      dockProgress.value,
      [0, 1],
      [FULL_HEIGHT, DOCKED_HEIGHT + insets.bottom],
      Extrapolate.CLAMP
    );

    // Border Radius Interpolation
    const borderRadius = interpolate(
      dockProgress.value,
      [0, 1],
      [0, 24],
      Extrapolate.CLAMP
    );

    // Margin/Width Interpolation for floating effect when docked
    const width = interpolate(
      dockProgress.value,
      [0, 1],
      [SCREEN_WIDTH, SCREEN_WIDTH - 32],
      Extrapolate.CLAMP
    );

    const marginHorizontal = interpolate(
      dockProgress.value,
      [0, 1],
      [0, 16],
      Extrapolate.CLAMP
    );

    // Position Y - When docked, sit at bottom. When expanded, fill screen.
    // We combine slideAnim (for open/close) with docking logic.
    // If not visible, slideAnim takes over.
    // If visible, docking logic positions it.
    
    // Calculate top offset for docked state
    const dockedTop = SCREEN_HEIGHT - (DOCKED_HEIGHT + insets.bottom + 20); // 20px padding from bottom
    
    const translateY = interpolate(
      dockProgress.value,
      [0, 1],
      [0, 0], // We handle Y via top/height, or we can just translate.
      // Let's use standard translation relative to screen
      Extrapolate.CLAMP
    );
    
    // Actually, simpler approach:
    // Fixed at bottom, animate height.
    // BUT we want it to look like it slides DOWN into the dock.
    
    const top = interpolate(
        dockProgress.value,
        [0, 1],
        [0, dockedTop],
        Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY: slideAnim.value + top }], // Combine initial slide + dock slide
      height: currentHeight,
      width,
      borderRadius,
      marginHorizontal,
      overflow: 'hidden',
    };
  });

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Dimmed Background - only when expanded */}
        <Animated.View 
            pointerEvents="none"
            style={[
                StyleSheet.absoluteFill, 
                { backgroundColor: 'black' },
                useAnimatedStyle(() => ({
                    opacity: interpolate(dockProgress.value, [0, 1], [0.5, 0])
                }))
            ]} 
        />

        <PanGestureHandler onGestureEvent={onGestureEvent}>
            <Animated.View style={[styles.container, containerStyle]}>
                {/* Connecting State */}
                {(!token || !serverUrl || isConnecting) ? (
                    <View className="flex-1 bg-gray-900 items-center justify-center">
                         <ActivityIndicator size="large" color="#10B981" />
                         <Text className="text-white font-medium text-lg mt-4">Connecting to Voice Room...</Text>
                         <TouchableOpacity onPress={onLeave} className="mt-8 p-2 bg-gray-800 rounded-full">
                            <X size={24} color="white" />
                         </TouchableOpacity>
                    </View>
                ) : (
                    <LiveKitRoom
                        serverUrl={serverUrl}
                        token={token}
                        connect={true}
                        options={{
                            publishDefaults: {
                                audio: true,
                                video: false,
                            },
                            adaptiveStream: true,
                        }}
                        onDisconnected={onLeave}
                        style={{ flex: 1 }}
                    >
                        <RoomContent 
                            roomName={roomName} 
                            onLeave={onLeave} 
                            isDocked={isDocked}
                            toggleDock={toggleDock}
                            dockProgress={dockProgress}
                        />
                    </LiveKitRoom>
                )}
            </Animated.View>
        </PanGestureHandler>
    </View>
  );
};

const RoomContent = ({
  roomName,
  onLeave,
  isDocked,
  toggleDock,
  dockProgress
}: {
  roomName: string;
  onLeave: () => void;
  isDocked: boolean;
  toggleDock: () => void;
  dockProgress: Animated.SharedValue<number>;
}) => {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  const { user } = useUser();
  
  const tracks = useTracks([Track.Source.Microphone]);

  const toggleMic = async () => {
    if (localParticipant.isMicrophoneEnabled) {
      await localParticipant.setMicrophoneEnabled(false);
    } else {
      await localParticipant.setMicrophoneEnabled(true);
    }
  };
  
  const expandedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(dockProgress.value, [0, 0.5], [1, 0], Extrapolate.CLAMP),
      transform: [{ scale: interpolate(dockProgress.value, [0, 1], [1, 0.95], Extrapolate.CLAMP) }]
  }));
  
  const dockedStyle = useAnimatedStyle(() => ({
      opacity: interpolate(dockProgress.value, [0.8, 1], [0, 1], Extrapolate.CLAMP),
  }));

  return (
    <View style={{ flex: 1 }}>
        <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
            colors={['rgba(17, 24, 39, 0.7)', 'rgba(17, 24, 39, 0.95)']}
            style={StyleSheet.absoluteFill}
        />
        
        {/* === EXPANDED CONTENT === */}
        <Animated.View style={[StyleSheet.absoluteFill, expandedStyle]} pointerEvents={isDocked ? 'none' : 'auto'}>
            <SafeAreaView className="flex-1">
                 {/* Drag Handle & Header */}
                <View className="items-center pt-2 pb-4">
                    <View className="w-12 h-1.5 rounded-full bg-white/20 mb-4" />
                    
                    <View className="flex-row items-center justify-between w-full px-6">
                        <TouchableOpacity 
                            onPress={toggleDock}
                            className="w-10 h-10 items-center justify-center bg-white/10 rounded-full"
                        >
                            <ChevronDown size={24} color="white" />
                        </TouchableOpacity>
                        
                        <View className="items-center">
                            <Text className="text-white text-xl font-bold tracking-tight">{roomName}</Text>
                            <View className="flex-row items-center mt-1 bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20">
                                <View className="w-1.5 h-1.5 rounded-full bg-green-500 mr-2" />
                                <Text className="text-green-400 text-xs font-semibold">
                                    {remoteParticipants.length + 1} LIVE
                                </Text>
                            </View>
                        </View>
                        
                        <TouchableOpacity 
                            onPress={() => room.disconnect()} 
                            className="w-10 h-10 items-center justify-center bg-red-500/10 rounded-full"
                        >
                            <X size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Participants Grid - Centered */}
                <View className="flex-1 justify-center px-4">
                    <View className="flex-row flex-wrap justify-center gap-6">
                        {/* Local Participant */}
                        <ParticipantAvatar 
                            participant={localParticipant} 
                            isLocal={true} 
                            imageUrl={user?.image}
                        />

                        {/* Remote Participants */}
                        {remoteParticipants.map((p) => (
                            <ParticipantAvatar 
                                key={p.identity} 
                                participant={p} 
                                isLocal={false} 
                                // LiveKit metadata usually stores a JSON string
                                imageUrl={p.metadata ? JSON.parse(p.metadata).image : undefined} 
                            />
                        ))}
                    </View>
                </View>

                {/* Controls Area */}
                <View className="px-8 pb-8">
                    <View className="flex-row justify-center gap-6 mb-8">
                         <TouchableOpacity
                            onPress={toggleMic}
                            className={`w-16 h-16 rounded-full items-center justify-center shadow-lg ${
                                localParticipant.isMicrophoneEnabled ? "bg-white" : "bg-white/10"
                            }`}
                         >
                            {localParticipant.isMicrophoneEnabled ? (
                                <Mic size={28} color="#000" />
                            ) : (
                                <MicOff size={28} color="#FFF" />
                            )}
                         </TouchableOpacity>
                         
                         <TouchableOpacity 
                            className="w-16 h-16 rounded-full items-center justify-center bg-white/10"
                         >
                             <Volume2 size={28} color="white" />
                         </TouchableOpacity>
                    </View>
                    
                    <TouchableOpacity
                        onPress={() => room.disconnect()}
                        className="w-full bg-red-500/90 py-4 rounded-2xl items-center shadow-lg active:bg-red-600"
                    >
                        <Text className="text-white font-bold text-lg">End Call</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </Animated.View>
        
        {/* === DOCKED CONTENT === */}
        <Animated.View 
            style={[
                StyleSheet.absoluteFill, 
                dockedStyle, 
                { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20 }
            ]}
            pointerEvents={isDocked ? 'auto' : 'none'}
        >
             {/* Left: Active Speakers Preview */}
             <TouchableOpacity onPress={toggleDock} className="flex-1 flex-row items-center">
                 <View className="flex-row mr-3">
                    <View className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-white items-center justify-center z-20">
                         {user?.image ? (
                             <Image source={{ uri: user.image }} className="w-full h-full rounded-full" />
                         ) : (
                             <Text className="text-white font-bold text-xs">You</Text>
                         )}
                    </View>
                    {remoteParticipants.slice(0, 2).map((p, i) => (
                        <View key={p.identity} className="w-10 h-10 rounded-full bg-gray-600 border-2 border-white items-center justify-center -ml-4 z-10">
                             {p.metadata && JSON.parse(p.metadata).image ? (
                                <Image source={{ uri: JSON.parse(p.metadata).image }} className="w-full h-full rounded-full" />
                             ) : (
                                <Text className="text-white font-bold text-xs">
                                    {p.name?.substring(0, 1).toUpperCase()}
                                </Text>
                             )}
                        </View>
                    ))}
                 </View>
                 
                 <View>
                     <Text className="text-white font-bold text-sm">Voice Active</Text>
                     <Text className="text-green-400 text-xs">{remoteParticipants.length + 1} connected</Text>
                 </View>
             </TouchableOpacity>
             
             {/* Right: Quick Controls */}
             <View className="flex-row items-center gap-3">
                 <TouchableOpacity
                    onPress={toggleMic}
                    className={`w-10 h-10 rounded-full items-center justify-center ${
                        localParticipant.isMicrophoneEnabled ? "bg-white" : "bg-red-500/20"
                    }`}
                 >
                    {localParticipant.isMicrophoneEnabled ? (
                        <Mic size={18} color="#000" />
                    ) : (
                        <MicOff size={18} color="#EF4444" />
                    )}
                 </TouchableOpacity>
                 
                 <TouchableOpacity
                    onPress={() => room.disconnect()}
                    className="w-10 h-10 rounded-full bg-red-500/20 items-center justify-center"
                 >
                    <PhoneOff size={18} color="#EF4444" />
                 </TouchableOpacity>
             </View>
        </Animated.View>
    </View>
  );
};

const ParticipantAvatar = ({
  participant,
  isLocal,
  imageUrl,
}: {
  participant: any;
  isLocal: boolean;
  imageUrl?: string | null;
}) => {
  const isSpeaking = participant.isSpeaking;
  const isMuted = !participant.isMicrophoneEnabled;
  
  // Pulse animation for speaking
  const pulseAnim = useSharedValue(1);
  
  useEffect(() => {
      if (isSpeaking) {
          pulseAnim.value = withRepeat(
              withSequence(
                  withTiming(1.15, { duration: 600 }),
                  withTiming(1, { duration: 600 })
              ),
              -1,
              true
          );
      } else {
          pulseAnim.value = withTiming(1);
      }
  }, [isSpeaking]);
  
  const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulseAnim.value }],
      borderColor: isSpeaking ? '#10B981' : 'transparent',
      borderWidth: isSpeaking ? 3 : 0,
  }));

  return (
    <View className="items-center mx-3 mb-6">
      <View className="w-24 h-24 items-center justify-center relative">
          {/* Pulse Ring */}
          <Animated.View 
            style={[
                {
                    width: 88, 
                    height: 88, 
                    borderRadius: 44, 
                    position: 'absolute',
                    backgroundColor: isSpeaking ? 'rgba(16, 185, 129, 0.2)' : 'transparent'
                },
                animatedStyle
            ]} 
          />
          
          {/* Avatar Circle */}
          <View className="w-20 h-20 rounded-full bg-gray-700 items-center justify-center overflow-hidden z-10 border-2 border-white/20 shadow-xl">
              {imageUrl ? (
                  <Image source={{ uri: imageUrl }} className="w-full h-full" resizeMode="cover" />
              ) : (
                  <LinearGradient
                    colors={['#6366f1', '#4f46e5']}
                    style={StyleSheet.absoluteFill}
                    className="items-center justify-center"
                  >
                      <Text className="text-white text-3xl font-bold">
                          {isLocal ? "Y" : (participant.name || "?").substring(0, 1).toUpperCase()}
                      </Text>
                  </LinearGradient>
              )}
          </View>
          
          {/* Mute Icon Badge */}
          {isMuted && (
             <View className="absolute bottom-0 right-0 bg-red-500 rounded-full p-2 z-20 border-2 border-gray-900 shadow-sm">
                 <MicOff size={12} color="white" />
             </View>
          )}
      </View>
      
      <Text className="text-white font-semibold text-sm mt-2 shadow-black shadow-sm">
        {isLocal ? "You" : participant.name || "Unknown"}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
    container: {
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    }
});
