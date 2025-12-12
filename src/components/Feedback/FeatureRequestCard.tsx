import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { ArrowBigUp, ArrowBigDown } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { FeatureRequest, useVoteRequest } from "@/hooks/useFeedback";
import { useUser } from "@/contexts/UserContext";
import { GradientText } from "@/components/GradientText";
import * as Haptics from "expo-haptics";
import { Alert } from "react-native";

interface FeatureRequestCardProps {
  request: FeatureRequest;
  isRoadmap?: boolean;
}

const FeatureRequestCard: React.FC<FeatureRequestCardProps> = ({ request, isRoadmap }) => {
  const { user } = useUser();
  const { mutate: vote } = useVoteRequest();

  const isOwnRequest = user?.id === request.userId;

  const handleVote = (type: 'up' | 'down') => {
    if (isOwnRequest) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert("Cannot Vote", "You cannot vote on your own request.");
      return;
    }

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    vote({ requestId: request.id, voteType: type });
  };

  const getStatusColors = (status: string) => {
    switch (status) {
      case 'planned': return ['#34C759', '#30B350']; // Green
      case 'in_progress': return ['#FF9500', '#FFAB33']; // Orange
      case 'completed': return ['#007AFF', '#00A8E8']; // Blue
      case 'rejected': return ['#FF3B30', '#FF6B61']; // Red
      default: return ['#8E8E93', '#AAB']; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={30} tint="dark" style={styles.blur}>
        <View style={styles.content}>
          <View style={styles.voteContainer}>
            <Pressable 
              onPress={() => handleVote('up')}
              style={[
                styles.voteButton, 
                request.userVote === 'up' && styles.votedUp,
                isOwnRequest && styles.disabledVote
              ]}
              disabled={isOwnRequest}
            >
              <ArrowBigUp 
                size={24} 
                color={
                  request.userVote === 'up' ? "#34C759" : 
                  isOwnRequest ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)"
                } 
                fill={request.userVote === 'up' ? "#34C759" : "transparent"}
              />
            </Pressable>
            
            {request.userVote === 'up' ? (
              <GradientText colors={["#34C759", "#00FF80"]} style={styles.score}>
                {request.score.toString()}
              </GradientText>
            ) : request.userVote === 'down' ? (
              <Text style={[styles.score, { color: '#FF3B30' }]}>
                {request.score}
              </Text>
            ) : (
              <Text style={[styles.score, isOwnRequest && { color: 'rgba(255,255,255,0.2)' }]}>
                {request.score}
              </Text>
            )}

            <Pressable 
              onPress={() => handleVote('down')}
              style={[
                styles.voteButton, 
                request.userVote === 'down' && styles.votedDown,
                isOwnRequest && styles.disabledVote
              ]}
              disabled={isOwnRequest}
            >
              <ArrowBigDown 
                size={24} 
                color={
                  request.userVote === 'down' ? "#FF3B30" : 
                  isOwnRequest ? "rgba(255,255,255,0.1)" : "rgba(255,255,255,0.3)"
                }
                fill={request.userVote === 'down' ? "#FF3B30" : "transparent"}
              />
            </Pressable>
          </View>

          <View style={styles.textContainer}>
            <View style={styles.headerRow}>
              <Text style={styles.title}>{request.title}</Text>
              {isRoadmap && (
                <LinearGradient
                  colors={getStatusColors(request.status) as any}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.badge}
                >
                  <Text style={styles.badgeText}>
                    {getStatusLabel(request.status)}
                  </Text>
                </LinearGradient>
              )}
            </View>
            {request.description && (
              <Text style={styles.description}>{request.description}</Text>
            )}
          </View>
        </View>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(20, 20, 25, 0.4)',
  },
  blur: {
    padding: 16,
  },
  content: {
    flexDirection: 'row',
  },
  voteContainer: {
    alignItems: 'center',
    marginRight: 16,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 16,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  voteButton: {
    padding: 4,
  },
  disabledVote: {
    opacity: 0.5,
  },
  votedUp: {
    // transform: [{ scale: 1.1 }],
  },
  votedDown: {
    // transform: [{ scale: 1.1 }],
  },
  score: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
    marginVertical: 4,
  },
  textContainer: {
    flex: 1,
    paddingTop: 4,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
    flexWrap: 'wrap',
    gap: 8,
  },
  title: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
    lineHeight: 22,
    letterSpacing: 0.3,
  },
  description: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFF',
    letterSpacing: 0.5,
  },
});

export default FeatureRequestCard;
