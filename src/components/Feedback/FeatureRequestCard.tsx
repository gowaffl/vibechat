import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { BlurView } from "expo-blur";
import { ArrowBigUp, ArrowBigDown } from "lucide-react-native";
import { FeatureRequest, useVoteRequest } from "@/hooks/useFeedback";
import { useUser } from "@/contexts/UserContext";
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'planned': return '#34C759'; // Green
      case 'in_progress': return '#FF9500'; // Orange
      case 'completed': return '#007AFF'; // Blue
      case 'rejected': return '#FF3B30'; // Red
      default: return '#8E8E93'; // Gray
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace('_', ' ').toUpperCase();
  };

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={styles.blur}>
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
            
            <Text style={[
              styles.score,
              request.userVote === 'up' && { color: '#34C759' },
              request.userVote === 'down' && { color: '#FF3B30' },
              isOwnRequest && { color: 'rgba(255,255,255,0.3)' }
            ]}>
              {request.score}
            </Text>

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
                <View style={[styles.badge, { backgroundColor: getStatusColor(request.status) + '30', borderColor: getStatusColor(request.status) }]}>
                  <Text style={[styles.badgeText, { color: getStatusColor(request.status) }]}>
                    {getStatusLabel(request.status)}
                  </Text>
                </View>
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
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 4,
    width: 44,
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
    fontWeight: 'bold',
    fontSize: 14,
    marginVertical: 4,
  },
  textContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 4,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    lineHeight: 20,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});

export default FeatureRequestCard;
