import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { ChangelogEntry } from "@/hooks/useFeedback";
import { format } from "date-fns";

interface ChangelogCardProps {
  entry: ChangelogEntry;
}

const ChangelogCard: React.FC<ChangelogCardProps> = ({ entry }) => {
  return (
    <View style={styles.container}>
      <View style={styles.timelineLine} />
      <View style={styles.timelineDot} />
      
      <BlurView intensity={20} tint="dark" style={styles.blur}>
        <View style={styles.header}>
          <Text style={styles.version}>{entry.version || 'Update'}</Text>
          <Text style={styles.date}>{format(new Date(entry.publishedAt), 'MMM d, yyyy')}</Text>
        </View>
        <Text style={styles.title}>{entry.title}</Text>
        <Text style={styles.description}>{entry.description}</Text>
      </BlurView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginLeft: 24,
    marginBottom: 24,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: -24,
    top: 24,
    bottom: -24,
    width: 2,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  timelineDot: {
    position: 'absolute',
    left: -29,
    top: 24,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#007AFF',
    borderWidth: 2,
    borderColor: '#000',
  },
  blur: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  version: {
    color: '#007AFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  date: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  description: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    lineHeight: 22,
  },
});

export default ChangelogCard;
