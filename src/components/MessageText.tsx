import React from "react";
import { Text, Pressable, View, Platform } from "react-native";
import Markdown from "react-native-markdown-display";
import type { Mention } from "@shared/contracts";
import * as Haptics from "expo-haptics";

interface MessageTextProps {
  content: string;
  mentions?: Mention[];
  style?: any;
  isOwnMessage?: boolean;
}

/**
 * MessageText component - Renders message text with markdown formatting and highlighted @mentions
 * Styled like iMessage with blue, tappable mentions and professional markdown rendering
 */
const MessageText: React.FC<MessageTextProps> = ({
  content,
  mentions = [],
  style,
  isOwnMessage = false,
}) => {
  // Check if content has markdown syntax
  const hasMarkdown = /(\*\*|__|\*|_|`|```|#{1,6}\s|>\s|\n[-*+]\s|\n\d+\.\s|\[.+\]\(.+\)|!\[.+\]\(.+\))/.test(content);

  // Extract text color from style for markdown text elements
  const textColor = style?.color || "#FFFFFF";
  const fontSize = style?.fontSize || 16;
  const lineHeight = style?.lineHeight || 22;

  // Build a map of mentioned user names to their user objects
  const mentionMap = new Map<string, Mention>();
  if (mentions && mentions.length > 0) {
    mentions.forEach((mention) => {
      if (mention.mentionedUser) {
        mentionMap.set(mention.mentionedUser.name, mention);
      }
    });
  }

  // If content has markdown, render with Markdown component
  if (hasMarkdown) {
    // Process mentions in markdown content
    let processedContent = content;
    
    // Find and mark mentions for special rendering
    if (mentions && mentions.length > 0) {
      mentions.forEach((mention) => {
        if (mention.mentionedUser) {
          const mentionPattern = new RegExp(`@${mention.mentionedUser.name}(?!\\w)`, 'g');
          // Wrap mentions in special markdown that will be styled
          processedContent = processedContent.replace(
            mentionPattern,
            `**@${mention.mentionedUser.name}**`
          );
        }
      });
    }

    return (
      <Markdown
        style={{
          body: { color: textColor, fontSize, lineHeight },
          heading1: { color: textColor, fontSize: fontSize + 8, fontWeight: "700", marginVertical: 4 },
          heading2: { color: textColor, fontSize: fontSize + 6, fontWeight: "700", marginVertical: 4 },
          heading3: { color: textColor, fontSize: fontSize + 4, fontWeight: "600", marginVertical: 4 },
          heading4: { color: textColor, fontSize: fontSize + 2, fontWeight: "600", marginVertical: 2 },
          heading5: { color: textColor, fontSize: fontSize + 1, fontWeight: "600", marginVertical: 2 },
          heading6: { color: textColor, fontSize, fontWeight: "600", marginVertical: 2 },
          strong: { 
            color: isOwnMessage ? "#FFFFFF" : "#007AFF",
            fontWeight: "700",
          },
          em: { color: textColor, fontStyle: "italic" },
          link: { color: isOwnMessage ? "#A0D4FF" : "#007AFF", textDecorationLine: "underline" },
          blockquote: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 122, 255, 0.1)",
            borderLeftColor: isOwnMessage ? "rgba(255, 255, 255, 0.3)" : "#007AFF",
            borderLeftWidth: 3,
            paddingLeft: 12,
            marginVertical: 8,
            paddingVertical: 4,
          },
          code_inline: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 122, 255, 0.1)",
            color: textColor,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            fontSize: fontSize - 1,
            paddingHorizontal: 6,
            paddingVertical: 2,
            borderRadius: 4,
          },
          code_block: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 122, 255, 0.1)",
            color: textColor,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            fontSize: fontSize - 1,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
          },
          fence: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 122, 255, 0.1)",
            color: textColor,
            fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
            fontSize: fontSize - 1,
            padding: 12,
            borderRadius: 8,
            marginVertical: 8,
          },
          bullet_list: { marginVertical: 4 },
          ordered_list: { marginVertical: 4 },
          list_item: { color: textColor, fontSize, lineHeight, marginVertical: 2 },
          paragraph: { color: textColor, fontSize, lineHeight, marginVertical: 4 },
          text: { color: textColor, fontSize, lineHeight },
          hr: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 122, 255, 0.2)",
            height: 1,
            marginVertical: 10,
          },
          table: { 
            borderWidth: 1,
            borderColor: isOwnMessage ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 122, 255, 0.2)",
            borderRadius: 8,
            marginVertical: 8,
          },
          thead: { 
            backgroundColor: isOwnMessage ? "rgba(255, 255, 255, 0.1)" : "rgba(0, 122, 255, 0.1)",
          },
          tbody: {},
          th: { 
            color: textColor,
            fontSize,
            fontWeight: "600",
            padding: 8,
            borderWidth: 1,
            borderColor: isOwnMessage ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 122, 255, 0.2)",
          },
          tr: {},
          td: { 
            color: textColor,
            fontSize,
            padding: 8,
            borderWidth: 1,
            borderColor: isOwnMessage ? "rgba(255, 255, 255, 0.2)" : "rgba(0, 122, 255, 0.2)",
          },
        }}
      >
        {processedContent}
      </Markdown>
    );
  }

  // No markdown detected - use the original mention highlighting logic
  if (!mentions || mentions.length === 0) {
    return <Text style={style}>{content}</Text>;
  }

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

