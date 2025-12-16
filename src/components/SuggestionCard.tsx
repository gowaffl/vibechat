import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Calendar, BarChart2, Check, X } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

interface SuggestionCardProps {
  type: "poll" | "event";
  data: any;
  onAccept: () => void;
  onReject: () => void;
}

export const SuggestionCard: React.FC<SuggestionCardProps> = ({
  type,
  data,
  onAccept,
  onReject,
}) => {
  const isPoll = type === "poll";
  
  return (
    <View className="mt-2 mb-1 rounded-2xl overflow-hidden border border-white/10 shadow-sm">
      <LinearGradient
        colors={isPoll ? ["#4F46E520", "#4F46E510"] : ["#10B98120", "#10B98110"]}
        style={StyleSheet.absoluteFill}
      />
      
      <View className="p-4">
        <View className="flex-row items-center gap-2 mb-2">
          {isPoll ? (
            <BarChart2 size={16} color="#818CF8" />
          ) : (
            <Calendar size={16} color="#34D399" />
          )}
          <Text className="text-xs font-bold uppercase tracking-wider text-gray-400">
            {isPoll ? "Suggested Poll" : "Suggested Event"}
          </Text>
        </View>

        <Text className="text-white font-semibold text-base mb-1">
          {isPoll ? data.question : data.title}
        </Text>
        
        {isPoll && data.options && (
          <View className="mt-2 gap-1">
            {data.options.map((opt: string, i: number) => (
              <View key={i} className="flex-row items-center gap-2">
                <View className="w-1.5 h-1.5 rounded-full bg-gray-500" />
                <Text className="text-gray-300 text-sm">{opt}</Text>
              </View>
            ))}
          </View>
        )}

        {!isPoll && (
          <Text className="text-gray-300 text-sm mt-1">
            {data.startTime || "Upcoming"} {data.location ? `• ${data.location}` : ""}
          </Text>
        )}

        <View className="flex-row items-center gap-3 mt-4">
          <TouchableOpacity 
            onPress={onAccept}
            className="flex-1 bg-white/10 h-9 rounded-lg flex-row items-center justify-center gap-2 active:bg-white/20"
          >
            <Check size={16} color="white" />
            <Text className="text-white font-medium text-sm">Create</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            onPress={onReject}
            className="w-9 h-9 rounded-lg items-center justify-center bg-white/5 active:bg-white/10"
          >
            <X size={16} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

