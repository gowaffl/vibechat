import React, { useState } from "react";
import { View, Text, StyleSheet, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { X } from "lucide-react-native";
import { useCreateRequest } from "@/hooks/useFeedback";
import * as Haptics from "expo-haptics";

interface CreateRequestModalProps {
  visible: boolean;
  onClose: () => void;
}

const CreateRequestModal: React.FC<CreateRequestModalProps> = ({ visible, onClose }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const { mutate: createRequest, isPending } = useCreateRequest();

  const handleSubmit = () => {
    if (!title.trim()) return;
    
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    createRequest({ title, description }, {
      onSuccess: () => {
        setTitle("");
        setDescription("");
        onClose();
      }
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <BlurView intensity={80} tint="dark" style={styles.blur}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.headerTitle}>New Request</Text>
              <Pressable onPress={onClose} style={styles.closeButton}>
                <X size={24} color="#FFF" />
              </Pressable>
            </View>

            <View style={styles.form}>
              <Text style={styles.label}>Title</Text>
              <TextInput
                style={styles.input}
                placeholder="What's your idea?"
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={title}
                onChangeText={setTitle}
                autoFocus
              />

              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Explain how it should work..."
                placeholderTextColor="rgba(255,255,255,0.3)"
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
              />
            </View>

            <Pressable 
              style={[styles.submitButton, (!title.trim() || isPending) && styles.disabledButton]}
              onPress={handleSubmit}
              disabled={!title.trim() || isPending}
            >
              <Text style={styles.submitButtonText}>
                {isPending ? "Submitting..." : "Submit Request"}
              </Text>
            </Pressable>
          </View>
        </BlurView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  blur: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 48,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  form: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 8,
  },
  input: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    color: '#FFF',
    fontSize: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  textArea: {
    height: 120,
  },
  submitButton: {
    backgroundColor: '#007AFF',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default CreateRequestModal;
