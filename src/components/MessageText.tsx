import React from "react";
import { Text, Pressable } from "react-native";
import type { Mention } from "@shared/contracts";
import * as Haptics from "expo-haptics";

interface MessageTextProps {
  content: string;
  mentions?: Mention[];
  style?: any;
  isOwnMessage?: boolean;
}

/**
 * MessageText component - Renders message text with highlighted @mentions
 * Styled like iMessage with blue, tappable mentions
 */
const MessageText: React.FC<MessageTextProps> = ({
  content,
  mentions = [],
  style,
  isOwnMessage = false,
}) => {
  // If no mentions, just render plain text
  if (!mentions || mentions.length === 0) {
    return <Text style={style}>{content}</Text>;
  }

  // Build a map of mentioned user names to their user objects
  const mentionMap = new Map<string, Mention>();
  mentions.forEach((mention) => {
    if (mention.mentionedUser) {
      mentionMap.set(mention.mentionedUser.name, mention);
    }
  });

  // Parse the content and identify @mentions
  const parts: Array<{ text: string; isMention: boolean; mention?: Mention }> = [];
  let lastIndex = 0;
  const regex = /@\w+(\s+\w+)*/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const mentionText = match[0]; // e.g., "@John Doe"
    const mentionName = mentionText.substring(1); // Remove the "@"

    // Add text before the mention
    if (match.index > lastIndex) {
      parts.push({
        text: content.substring(lastIndex, match.index),
        isMention: false,
      });
    }

    // Check if this is a real mention
    const mention = mentionMap.get(mentionName);
    if (mention) {
      parts.push({
        text: mentionText,
        isMention: true,
        mention,
      });
    } else {
      // Not a real mention, just regular text
      parts.push({
        text: mentionText,
        isMention: false,
      });
    }

    lastIndex = match.index + mentionText.length;
  }

  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      text: content.substring(lastIndex),
      isMention: false,
    });
  }

  // If no matches, return plain text
  if (parts.length === 0) {
    return <Text style={style}>{content}</Text>;
  }

  const handleMentionPress = (mention: Mention) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    // TODO: Navigate to user profile or show user info
    console.log("[@] Mention tapped:", mention.mentionedUser?.name);
  };

  return (
    <Text style={style}>
      {parts.map((part, index) => {
        if (part.isMention && part.mention) {
          return (
            <Pressable
              key={index}
              onPress={() => handleMentionPress(part.mention!)}
              style={({ pressed }) => ({
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Text
                style={{
                  color: isOwnMessage ? "#FFFFFF" : "#007AFF",
                  fontWeight: "600",
                  textDecorationLine: "none",
                }}
              >
                {part.text}
              </Text>
            </Pressable>
          );
        }
        return <Text key={index}>{part.text}</Text>;
      })}
    </Text>
  );
};

export default MessageText;

