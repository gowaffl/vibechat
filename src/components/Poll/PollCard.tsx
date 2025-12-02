import React, { useState } from "react";
import { View, Text, Pressable, Animated } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import LiquidGlassView from "../LiquidGlass/LiquidGlassView";
import { variantColorMap } from "../LiquidGlass/variants";
import { BarChart3, Check, Users, Clock, Award } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import type { Poll } from "@shared/contracts";

interface PollCardProps {
  poll: Poll;
  currentUserId: string;
  onVote: (optionId: string) => void;
  isVoting?: boolean;
}

const PollCard: React.FC<PollCardProps> = ({
  poll,
  currentUserId,
  onVote,
  isVoting = false,
}) => {
  const [selectedOptionId, setSelectedOptionId] = useState<string | null>(null);

  // Check if user has already voted
  const userVote = poll.votes?.find((v) => v.userId === currentUserId);
  const hasVoted = !!userVote;
  const isPollClosed = poll.status === "closed";
  const canVote = !hasVoted && !isPollClosed && !isVoting;

  // Calculate totals
  const totalVotes = poll.totalVotes || 0;
  const memberCount = poll.memberCount || 0;
  const votedPercentage = memberCount > 0 ? Math.round((totalVotes / memberCount) * 100) : 0;

  // Find winner (option with most votes)
  const sortedOptions = [...(poll.options || [])].sort(
    (a, b) => (b.voteCount || 0) - (a.voteCount || 0)
  );
  const winningOption = sortedOptions[0];
  const hasMultipleWinners =
    sortedOptions.filter((o) => o.voteCount === winningOption?.voteCount).length > 1;

  // Variant based on status
  const variant = isPollClosed ? "success" : "info";
  const variantColors = variantColorMap[variant];

  const handleOptionPress = (optionId: string) => {
    if (!canVote) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedOptionId(optionId);
    onVote(optionId);
  };

  return (
    <LiquidGlassView
      intensity={30}
      tint="dark"
      borderRadius={24}
      gradientColors={variantColors.gradientColors}
      borderColor={variantColors.borderColor}
      borderWidth={isPollClosed ? 2 : 1}
      shadowColor={variantColors.shadowColor}
      shadowIntensity="medium"
      style={{ marginTop: 8, marginBottom: 8 }}
    >
      {/* Header */}
      <View style={{ padding: 20, paddingBottom: 16 }}>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginBottom: 12,
          }}
        >
          <View
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: isPollClosed
                ? "rgba(48, 209, 88, 0.2)"
                : "rgba(0, 122, 255, 0.2)",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 10,
            }}
          >
            {isPollClosed ? (
              <Award size={20} color="#30D158" strokeWidth={2.5} />
            ) : (
              <BarChart3 size={20} color="#007AFF" strokeWidth={2.5} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: isPollClosed
                    ? "rgba(48, 209, 88, 0.8)"
                    : "rgba(0, 122, 255, 0.8)",
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                {isPollClosed ? "Poll Results" : "Poll"}
              </Text>
              {isPollClosed && (
                <View
                  style={{
                    marginLeft: 8,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    backgroundColor: "rgba(48, 209, 88, 0.2)",
                    borderRadius: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 10,
                      fontWeight: "600",
                      color: "#30D158",
                    }}
                  >
                    CLOSED
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Question */}
        <Text
          style={{
            fontSize: 18,
            fontWeight: "700",
            color: "#FFFFFF",
            lineHeight: 24,
            marginBottom: 4,
          }}
        >
          {poll.question}
        </Text>

        {/* Vote Stats */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <Users size={14} color="rgba(255, 255, 255, 0.5)" strokeWidth={2} />
          <Text
            style={{
              fontSize: 12,
              color: "rgba(255, 255, 255, 0.5)",
              marginLeft: 4,
            }}
          >
            {totalVotes} of {memberCount} voted ({votedPercentage}%)
          </Text>
          {!isPollClosed && !hasVoted && (
            <>
              <View
                style={{
                  width: 3,
                  height: 3,
                  borderRadius: 1.5,
                  backgroundColor: "rgba(255, 255, 255, 0.3)",
                  marginHorizontal: 8,
                }}
              />
              <Clock size={14} color="rgba(255, 255, 255, 0.5)" strokeWidth={2} />
              <Text
                style={{
                  fontSize: 12,
                  color: "rgba(255, 255, 255, 0.5)",
                  marginLeft: 4,
                }}
              >
                Tap to vote
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Options */}
      <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
        {poll.options?.map((option, index) => {
          const voteCount = option.voteCount || 0;
          const percentage =
            totalVotes > 0 ? Math.round((voteCount / totalVotes) * 100) : 0;
          const isUserChoice = userVote?.optionId === option.id;
          const isWinner =
            isPollClosed &&
            voteCount === winningOption?.voteCount &&
            !hasMultipleWinners;
          const isSelected = selectedOptionId === option.id;
          const showProgress = hasVoted || isPollClosed;

          return (
            <Pressable
              key={option.id}
              onPress={() => handleOptionPress(option.id)}
              disabled={!canVote}
              style={({ pressed }) => ({
                marginBottom: index < (poll.options?.length || 0) - 1 ? 10 : 0,
                opacity: isVoting && isSelected ? 0.7 : pressed && canVote ? 0.9 : 1,
                transform: [{ scale: pressed && canVote ? 0.98 : 1 }],
              })}
            >
              <View
                style={{
                  backgroundColor: isUserChoice
                    ? "rgba(0, 122, 255, 0.15)"
                    : isWinner
                    ? "rgba(48, 209, 88, 0.15)"
                    : "rgba(255, 255, 255, 0.05)",
                  borderRadius: 14,
                  borderWidth: isUserChoice ? 2 : isWinner ? 2 : 1,
                  borderColor: isUserChoice
                    ? "rgba(0, 122, 255, 0.4)"
                    : isWinner
                    ? "rgba(48, 209, 88, 0.4)"
                    : "rgba(255, 255, 255, 0.1)",
                  overflow: "hidden",
                }}
              >
                {/* Progress Bar Background */}
                {showProgress && (
                  <View
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      bottom: 0,
                      width: `${percentage}%`,
                      backgroundColor: isUserChoice
                        ? "rgba(0, 122, 255, 0.15)"
                        : isWinner
                        ? "rgba(48, 209, 88, 0.15)"
                        : "rgba(255, 255, 255, 0.05)",
                    }}
                  />
                )}

                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    padding: 14,
                  }}
                >
                  {/* Option Number or Check */}
                  <View
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 14,
                      backgroundColor: isUserChoice
                        ? "rgba(0, 122, 255, 0.3)"
                        : isWinner
                        ? "rgba(48, 209, 88, 0.3)"
                        : "rgba(255, 255, 255, 0.1)",
                      alignItems: "center",
                      justifyContent: "center",
                      marginRight: 12,
                    }}
                  >
                    {isUserChoice ? (
                      <Check
                        size={16}
                        color="#007AFF"
                        strokeWidth={3}
                      />
                    ) : isWinner ? (
                      <Award size={16} color="#30D158" strokeWidth={2.5} />
                    ) : (
                      <Text
                        style={{
                          fontSize: 13,
                          fontWeight: "700",
                          color: "rgba(255, 255, 255, 0.6)",
                        }}
                      >
                        {index + 1}
                      </Text>
                    )}
                  </View>

                  {/* Option Text */}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={{
                        fontSize: 15,
                        fontWeight: isUserChoice || isWinner ? "700" : "500",
                        color: isUserChoice
                          ? "#007AFF"
                          : isWinner
                          ? "#30D158"
                          : "#FFFFFF",
                      }}
                    >
                      {option.optionText}
                    </Text>
                  </View>

                  {/* Vote Count */}
                  {showProgress && (
                    <View
                      style={{
                        alignItems: "flex-end",
                        marginLeft: 12,
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 16,
                          fontWeight: "700",
                          color: isUserChoice
                            ? "#007AFF"
                            : isWinner
                            ? "#30D158"
                            : "rgba(255, 255, 255, 0.8)",
                        }}
                      >
                        {percentage}%
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          color: "rgba(255, 255, 255, 0.5)",
                          marginTop: 1,
                        }}
                      >
                        {voteCount} vote{voteCount !== 1 ? "s" : ""}
                      </Text>
                    </View>
                  )}
                </View>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* Footer for closed polls */}
      {isPollClosed && winningOption && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 16,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 24,
                height: 24,
                borderRadius: 12,
                backgroundColor: "rgba(48, 209, 88, 0.2)",
                alignItems: "center",
                justifyContent: "center",
                marginRight: 8,
              }}
            >
              <Text style={{ fontSize: 12 }}>🏆</Text>
            </View>
            <Text
              style={{
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.7)",
              }}
            >
              Winner:{" "}
              <Text style={{ fontWeight: "700", color: "#30D158" }}>
                {winningOption.optionText}
              </Text>
            </Text>
          </View>
        </View>
      )}

      {/* Footer for user who hasn't voted */}
      {!isPollClosed && hasVoted && (
        <View
          style={{
            paddingHorizontal: 20,
            paddingBottom: 16,
            paddingTop: 8,
            borderTopWidth: 1,
            borderTopColor: "rgba(255, 255, 255, 0.1)",
          }}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
            }}
          >
            <Check
              size={16}
              color="#30D158"
              strokeWidth={2.5}
              style={{ marginRight: 8 }}
            />
            <Text
              style={{
                fontSize: 13,
                color: "rgba(255, 255, 255, 0.6)",
              }}
            >
              You voted • Waiting for {memberCount - totalVotes} more
            </Text>
          </View>
        </View>
      )}
    </LiquidGlassView>
  );
};

export default PollCard;

