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
  Modal,
  TouchableWithoutFeedback,
  Alert,
  PermissionsAndroid,
  Keyboard,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import {
  LiveKitRoom,
  useLocalParticipant,
  useRemoteParticipants,
  useTracks,
  useRoomContext,
} from "@livekit/react-native";
import { Track, ParticipantEvent } from "livekit-client";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX, Maximize2, Minimize2, X, ChevronDown, Phone } from "lucide-react-native";
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
import * as Audio from "expo-audio";
import { useUser } from "@/contexts/UserContext";
import { getFullImageUrl } from "@/utils/imageHelpers";
import { useVoicePermissions } from "@/hooks/useVoicePermissions";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

// Constants matching ImagePreviewModal for consistent feel
const DOCKED_HEIGHT = 70; // Pill height
const PADDING_BOTTOM = 8; // Space between pill and input
const FULL_HEIGHT = SCREEN_HEIGHT;
const SPRING_CONFIG = { damping: 20, stiffness: 90 };

interface VoiceRoomModalProps {
  visible: boolean;
  token: string;
  serverUrl: string;
  roomName: string;
  onLeave: () => void;
  isConnecting?: boolean;
  chatInputHeight?: number;
  onDockStateChange?: (isDocked: boolean) => void;
}

export const VoiceRoomModal: React.FC<VoiceRoomModalProps> = ({
  visible,
  token,
  serverUrl,
  roomName,
  onLeave,
  isConnecting = false,
  chatInputHeight = 60,
  onDockStateChange,
}) => {
  const [isDocked, setIsDocked] = useState(false);
  const [connectionTimeout, setConnectionTimeout] = useState(false);
  const insets = useSafeAreaInsets();
  const { requestWithSettingsFallback } = useVoicePermissions();
  
  // 0 = Expanded (Fullscreen), 1 = Docked (Bottom Pill)
  const dockProgress = useSharedValue(0);
  
  // Slide animation for initial mount/unmount
  const slideAnim = useSharedValue(SCREEN_HEIGHT);

  // Configure audio session for background audio and proper routing
  const configureAudioSession = async () => {
    try {
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: true,
        // Allow both speaker and earpiece routing (iOS will handle proximity sensor)
        interruptionModeIOS: 1, // MixWithOthers
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1, // DuckOthers
        playThroughEarpieceAndroid: false, // Initially use speaker
      });
      console.log('[VoiceRoomModal] ✅ Audio session configured for background audio');
    } catch (error) {
      console.error('[VoiceRoomModal] ❌ Failed to configure audio session:', error);
    }
  };

  // Request audio permissions
  const requestAudioPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Microphone Permission',
            message: 'VibeChat needs access to your microphone for Vibe Calls',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          }
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('[VoiceRoomModal] Permission error:', err);
        return false;
      }
    }
    return true; // iOS handles permissions automatically
  };

  // Log ALL prop changes
  useEffect(() => {
    console.log('[VoiceRoomModal] Props changed:', {
      visible,
      hasToken: !!token,
      hasServerUrl: !!serverUrl,
      isConnecting,
      tokenPreview: token ? token.substring(0, 30) + '...' : 'none',
      serverUrl: serverUrl || 'none'
    });
  }, [visible, token, serverUrl, isConnecting]);

  useEffect(() => {
    console.log('[VoiceRoomModal] Visibility changed:', visible, 'Token:', !!token, 'ServerUrl:', !!serverUrl);
    if (visible) {
      // Configure audio session for background audio
      configureAudioSession();
      
      // Request permissions with settings fallback
      requestWithSettingsFallback().then(granted => {
        if (!granted) {
          onLeave();
        }
      });
      
      slideAnim.value = withSpring(0, SPRING_CONFIG);
      
      // Dismiss keyboard when modal opens in full mode (not docked)
      if (!isDocked) {
        Keyboard.dismiss();
      }
    } else {
      slideAnim.value = withTiming(SCREEN_HEIGHT, { duration: 300 });
      // Reset dock state when closed
      setIsDocked(false);
      dockProgress.value = 0;
    }
  }, [visible, isDocked, onLeave]);

  // Log when token/serverUrl change
  useEffect(() => {
    if (token && serverUrl) {
      console.log('[VoiceRoomModal] Credentials ready - Token:', token.substring(0, 20) + '...', 'ServerUrl:', serverUrl);
      setConnectionTimeout(false); // Reset timeout when credentials are ready
    }
  }, [token, serverUrl]);

  // Connection timeout - if still connecting after 15 seconds, show error
  useEffect(() => {
    if (visible && token && serverUrl && isConnecting) {
      const timeout = setTimeout(() => {
        console.error('[VoiceRoomModal] Connection timeout after 15 seconds');
        setConnectionTimeout(true);
      }, 15000);
      
      return () => clearTimeout(timeout);
    }
  }, [visible, token, serverUrl, isConnecting]);

  // Worklet friendly toggle handler
  const handleDockToggle = useCallback((shouldDock: boolean) => {
    setIsDocked(shouldDock);
    onDockStateChange?.(shouldDock);
    
    // Dismiss keyboard when modal is fully expanded (not docked)
    if (!shouldDock) {
      Keyboard.dismiss();
    }
  }, [onDockStateChange]);

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
    onDockStateChange?.(nextState);
    
    // Dismiss keyboard when modal is fully expanded (not docked)
    if (!nextState) {
      Keyboard.dismiss();
    }
  };

  // ALL useAnimatedStyle hooks BEFORE return statement
  const backgroundOpacityStyle = useAnimatedStyle(() => ({
    opacity: interpolate(dockProgress.value, [0, 1], [0.5, 0]),
  }));

  const containerStyle = useAnimatedStyle(() => {
    // Slide animation for open/close
    const openCloseTranslate = slideAnim.value;
    
    // Dock animation - when docked, translateY moves content up
    // dockedTranslate should be: SCREEN_HEIGHT - DOCKED_HEIGHT - chatInputHeight - PADDING_BOTTOM - insets.bottom
    const dockedTranslate = interpolate(
      dockProgress.value,
      [0, 1],
      [0, SCREEN_HEIGHT - DOCKED_HEIGHT - chatInputHeight - PADDING_BOTTOM - insets.bottom],
      Extrapolate.CLAMP
    );
    
    const height = interpolate(
      dockProgress.value,
      [0, 1],
      [SCREEN_HEIGHT, DOCKED_HEIGHT],
      Extrapolate.CLAMP
    );
    
    const borderRadius = interpolate(
      dockProgress.value,
      [0, 1],
      [0, 24],
      Extrapolate.CLAMP
    );
    
    const width = interpolate(
      dockProgress.value,
      [0, 1],
      [SCREEN_WIDTH, SCREEN_WIDTH - 32],
      Extrapolate.CLAMP
    );
    
    // Horizontal margin for centering when docked (animated via margin)
    const marginHorizontal = interpolate(
      dockProgress.value,
      [0, 1],
      [0, 16],
      Extrapolate.CLAMP
    );

    return {
      transform: [{ translateY: openCloseTranslate + dockedTranslate }],
      height,
      width,
      borderRadius,
      marginHorizontal, // Animated centering instead of alignSelf
      overflow: 'hidden' as const,
    };
  });

  // Don't render if not visible - use state-based check, not animated value
  if (!visible) return null;

  return (
    <View style={[StyleSheet.absoluteFill, { zIndex: 100 }]} pointerEvents="box-none">
      {/* Dimmed Background - only when visible and expanded */}
      {visible && (
        <Animated.View 
            pointerEvents={!isDocked ? "auto" : "none"} // Block touches when expanded, let pass when docked
            style={[
                StyleSheet.absoluteFill, 
                { backgroundColor: 'black' },
                backgroundOpacityStyle
            ]} 
        />
      )}

      <PanGestureHandler onGestureEvent={onGestureEvent}>
          <Animated.View style={[styles.container, containerStyle]}>
            {/* Always render LiveKitRoom to maintain consistent hook order */}
            <LiveKitRoom
                serverUrl={serverUrl || "ws://localhost:7880"}
                token={token || ""}
                connect={!!(token && serverUrl)}
                options={{
                    publishDefaults: {
                        audio: true,
                        video: false,
                    },
                    adaptiveStream: true,
                }}
                onConnected={() => {
                  console.log('[VoiceRoomModal] ✅ Connected to LiveKit room');
                }}
                onDisconnected={(reason) => {
                  console.log('[VoiceRoomModal] ❌ Disconnected from LiveKit:', reason);
                  onLeave();
                }}
                onError={(error) => {
                  console.error('[VoiceRoomModal] ❌ LiveKit error:', error);
                }}
                style={{ flex: 1 }}
            >
                <RoomContent 
                    roomName={roomName} 
                    onLeave={onLeave} 
                    isDocked={isDocked}
                    toggleDock={toggleDock}
                    dockProgress={dockProgress}
                    isConnecting={!token || !serverUrl || isConnecting}
                    connectionTimeout={connectionTimeout}
                />
            </LiveKitRoom>
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
  dockProgress,
  isConnecting,
  connectionTimeout
}: {
  roomName: string;
  onLeave: () => void;
  isDocked: boolean;
  toggleDock: () => void;
  dockProgress: Animated.SharedValue<number>;
  isConnecting: boolean;
  connectionTimeout: boolean;
}) => {
  const { localParticipant } = useLocalParticipant();
  const remoteParticipants = useRemoteParticipants();
  const room = useRoomContext();
  const { user } = useUser();
  const [isSpeakerOn, setIsSpeakerOn] = useState(true); // Default to speaker mode
  
  // Debug user image availability
  useEffect(() => {
    if (localParticipant) {
      console.log('[RoomContent] Local participant image check:', {
        hasUser: !!user,
        userId: user?.id,
        imageUrl: user?.image,
        isLocal: true
      });
    }
  }, [user, localParticipant]);

  const tracks = useTracks([Track.Source.Microphone]);

  // Debug room connection state
  useEffect(() => {
    console.log('[RoomContent] isConnecting:', isConnecting, 'Room state:', room.state);
  }, [isConnecting, room.state]);

  // Check if room is actually connected
  const isRoomConnected = room.state === 'connected';
  const shouldShowConnecting = isConnecting || !isRoomConnected;

  const toggleMic = async () => {
    if (localParticipant.isMicrophoneEnabled) {
      await localParticipant.setMicrophoneEnabled(false);
    } else {
      await localParticipant.setMicrophoneEnabled(true);
    }
  };

  const toggleSpeaker = async () => {
    try {
      const newSpeakerState = !isSpeakerOn;
      setIsSpeakerOn(newSpeakerState);
      
      await Audio.setAudioModeAsync({
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        allowsRecordingIOS: true,
        interruptionModeIOS: 1,
        shouldDuckAndroid: true,
        interruptionModeAndroid: 1,
        playThroughEarpieceAndroid: !newSpeakerState, // Toggle Android earpiece
        // Note: iOS handles speaker/earpiece via proximity sensor and AVAudioSession routing
      });
      
      console.log('[VoiceRoom] Audio routing changed:', newSpeakerState ? 'Speaker' : 'Earpiece');
    } catch (error) {
      console.error('[VoiceRoom] Failed to toggle speaker:', error);
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
        
        {/* Connecting Overlay - shows on top while connecting */}
        {shouldShowConnecting && (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(17, 24, 39, 0.98)', zIndex: 999 }]} className="items-center justify-center">
                {connectionTimeout ? (
                  <>
                    <X size={48} color="#EF4444" />
                    <Text className="text-white font-bold text-xl mt-4">Connection Failed</Text>
                    <Text className="text-gray-400 text-sm mt-2 px-8 text-center">
                      Unable to connect to the Vibe Call. Please check your connection and try again.
                    </Text>
                    <Text className="text-gray-500 text-xs mt-2">Room state: {room.state}</Text>
                    <TouchableOpacity 
                      onPress={onLeave} 
                      className="mt-8 px-6 py-3 bg-red-500 rounded-full"
                    >
                      <Text className="text-white font-semibold">Close</Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <ActivityIndicator size="large" color="#10B981" />
                    <Text className="text-white font-medium text-lg mt-4">Connecting to Vibe Call...</Text>
                    <Text className="text-gray-400 text-sm mt-2">Room state: {room.state}</Text>
                    <TouchableOpacity onPress={onLeave} className="mt-8 p-2 bg-gray-800 rounded-full">
                        <X size={24} color="white" />
                    </TouchableOpacity>
                  </>
                )}
            </View>
        )}
        
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
                        
                        {/* Empty view to balance layout since we removed the X button */}
                        <View className="w-10 h-10" />
                    </View>
                </View>

                {/* Participants Grid - Centered */}
                <View className="flex-1 justify-center px-4">
                    <View className="flex-row flex-wrap justify-center gap-6">
                        {/* Local Participant */}
                        <ParticipantAvatar 
                            participant={localParticipant} 
                            isLocal={true} 
                            imageUrl={getFullImageUrl(user?.image)}
                        />

                        {/* Remote Participants */}
                        {remoteParticipants.map((p) => {
                            let imageUrl: string | null = null;
                            try {
                              if (p.metadata) {
                                const metadata = JSON.parse(p.metadata);
                                imageUrl = getFullImageUrl(metadata.image);
                              }
                            } catch (e) {
                              console.warn('[VoiceRoom] Failed to parse participant metadata:', e);
                            }
                            
                            return (
                              <ParticipantAvatar 
                                  key={p.identity} 
                                  participant={p} 
                                  isLocal={false} 
                                  imageUrl={imageUrl}
                              />
                            );
                        })}
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
                            onPress={toggleSpeaker}
                            className={`w-16 h-16 rounded-full items-center justify-center shadow-lg ${
                                isSpeakerOn ? "bg-white" : "bg-white/10"
                            }`}
                         >
                             {isSpeakerOn ? (
                                <Volume2 size={28} color="#000" />
                             ) : (
                                <Phone size={28} color="#FFF" />
                             )}
                         </TouchableOpacity>
                    </View>
                    
                    <View className="items-center mb-4">
                        <Text className="text-white/60 text-xs font-medium">
                            {isSpeakerOn ? "Speaker On" : "Earpiece Mode"}
                        </Text>
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
                 <View className="flex-row mr-3 items-center">
                     <View className="w-10 h-10 rounded-full bg-indigo-500 border-2 border-white items-center justify-center z-50 overflow-hidden">
                         {user?.image ? (
                             <ExpoImage source={{ uri: getFullImageUrl(user.image) }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
                         ) : (
                             <Text className="text-white font-bold text-xs">You</Text>
                         )}
                    </View>
                    
                    {/* Remote Participants - Show up to 3 more (total 4 bubbles max) */}
                    {(() => {
                        const MAX_BUBBLES = 4;
                        // We already have 1 bubble for Local User
                        const maxRemoteBubbles = MAX_BUBBLES - 1;
                        // If we have more remote users than fit, reserve 1 spot for "+N" bubble
                        const showOverflow = remoteParticipants.length > maxRemoteBubbles;
                        const visibleRemoteCount = showOverflow ? maxRemoteBubbles - 1 : remoteParticipants.length;
                        
                        return (
                            <>
                                {remoteParticipants.slice(0, visibleRemoteCount).map((p, i) => {
                                    let imageUrl: string | null = null;
                                    try {
                                      if (p.metadata) {
                                        const metadata = JSON.parse(p.metadata);
                                        imageUrl = getFullImageUrl(metadata.image);
                                      }
                                    } catch (e) {
                                      console.warn('[VoiceRoom] Failed to parse participant metadata:', e);
                                    }
                                    
                                    return (
                                      <DockedParticipantAvatar 
                                        key={p.identity} 
                                        participant={p}
                                        imageUrl={imageUrl}
                                        index={i}
                                      />
                                    );
                                })}
                                
                                {showOverflow && (
                                    <View 
                                        className="w-10 h-10 rounded-full bg-gray-800 border-2 border-white items-center justify-center -ml-4"
                                        style={{ zIndex: 0 }}
                                    >
                                        <Text className="text-white font-bold text-xs">
                                            +{remoteParticipants.length - visibleRemoteCount}
                                        </Text>
                                    </View>
                                )}
                            </>
                        );
                    })()}
                 </View>
                 
                 <View>
                     <Text className="text-white font-bold text-sm">Vibe Call Active</Text>
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

// Hook to track participant audio state
const useParticipantAudio = (participant: any) => {
  const [isSpeaking, setIsSpeaking] = useState(participant.isSpeaking);
  const [audioLevel, setAudioLevel] = useState(participant.audioLevel || 0);

  useEffect(() => {
    if (!participant) return;

    const onSpeakingChanged = (speaking: boolean) => setIsSpeaking(speaking);
    const onAudioLevelChanged = (level: number) => setAudioLevel(level);

    participant.on(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
    participant.on(ParticipantEvent.AudioLevelChanged, onAudioLevelChanged);

    // Initial state
    setIsSpeaking(participant.isSpeaking);
    setAudioLevel(participant.audioLevel);

    return () => {
      participant.off(ParticipantEvent.IsSpeakingChanged, onSpeakingChanged);
      participant.off(ParticipantEvent.AudioLevelChanged, onAudioLevelChanged);
    };
  }, [participant]);

  return { isSpeaking, audioLevel };
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
  const { isSpeaking, audioLevel } = useParticipantAudio(participant);
  const isMuted = !participant.isMicrophoneEnabled;
  
  // Pulse animation for speaking driven by audio level
  const pulseAnim = useSharedValue(1);
  
  useEffect(() => {
      if (isSpeaking) {
          // Map audio level (0-1) to scale (1.05-1.4)
          // Use a minimum scale of 1.05 to show *some* activity even if level is low but speaking is true
          const targetScale = 1.05 + (audioLevel * 0.4);
          pulseAnim.value = withTiming(targetScale, { duration: 100 });
      } else {
          pulseAnim.value = withTiming(1, { duration: 200 });
      }
  }, [isSpeaking, audioLevel]);
  
  const animatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: pulseAnim.value }],
      opacity: interpolate(pulseAnim.value, [1, 1.4], [0.6, 0.2]), // Fade out as it expands
      borderColor: isSpeaking ? '#10B981' : 'transparent',
      borderWidth: isSpeaking ? 2 : 0,
  }));

  return (
    <View className="items-center mx-3 mb-6">
      <View className="w-24 h-24 items-center justify-center relative">
          {/* Dynamic Pulse Ring */}
          <Animated.View 
            style={[
                {
                    width: 88, 
                    height: 88, 
                    borderRadius: 44, 
                    position: 'absolute',
                    backgroundColor: isSpeaking ? 'rgba(16, 185, 129, 0.4)' : 'transparent'
                },
                animatedStyle
            ]} 
          />
          
          {/* Avatar Circle */}
          <View className="w-20 h-20 rounded-full bg-gray-700 items-center justify-center overflow-hidden z-10 border-2 border-white/20 shadow-xl">
              {imageUrl ? (
                  <ExpoImage 
                    source={{ uri: imageUrl }} 
                    style={{ width: '100%', height: '100%' }}
                    contentFit="cover"
                    onError={(e) => {
                      console.warn('[VoiceRoom] Failed to load avatar:', imageUrl, e);
                    }}
                  />
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

const DockedParticipantAvatar = ({
  participant,
  imageUrl,
  index
}: {
  participant: any;
  imageUrl?: string | null;
  index: number;
}) => {
  const { isSpeaking } = useParticipantAudio(participant);
  
  return (
    <View 
      className={`w-10 h-10 rounded-full bg-gray-600 border-2 items-center justify-center -ml-4 overflow-hidden ${
        isSpeaking ? 'border-green-500' : 'border-white'
      }`}
      style={{ zIndex: 40 - index }}
    >
         {imageUrl ? (
            <ExpoImage source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
         ) : (
            <Text className="text-white font-bold text-xs">
                {participant.name?.substring(0, 1).toUpperCase()}
            </Text>
         )}
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
