/**
 * Translation Toggle Component
 *
 * A toggle for enabling/disabling live message translation.
 * Shows language selector when enabled.
 */

import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
  Dimensions,
} from "react-native";
import { BlurView } from "expo-blur";
import { Languages, Check, ChevronDown, X } from "lucide-react-native";
import * as Haptics from "expo-haptics";
import { useTheme } from "@/contexts/ThemeContext";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

interface TranslationToggleProps {
  enabled: boolean;
  selectedLanguage: string;
  onToggle: (enabled: boolean) => void;
  onLanguageSelect: (languageCode: string) => void;
}

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇵🇹" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "zh", name: "Chinese (Simplified)", flag: "🇨🇳" },
  { code: "zh-TW", name: "Chinese (Traditional)", flag: "🇹🇼" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "tl", name: "Tagalog", flag: "🇵🇭" },
];

const TranslationToggle: React.FC<TranslationToggleProps> = ({
  enabled,
  selectedLanguage,
  onToggle,
  onLanguageSelect,
}) => {
  const { colors, isDark } = useTheme();
  const [showLanguagePicker, setShowLanguagePicker] = useState(false);

  const selectedLang = LANGUAGES.find((l) => l.code === selectedLanguage);
  const hasLanguageSelected = selectedLanguage && selectedLanguage !== "";

  const handleToggle = () => {
    Haptics.selectionAsync();
    const newEnabled = !enabled;
    onToggle(newEnabled);
    
    // If turning on and no language selected, automatically show picker
    if (newEnabled && !hasLanguageSelected) {
      setShowLanguagePicker(true);
    }
  };

  const handleLanguageSelect = (code: string) => {
    Haptics.selectionAsync();
    onLanguageSelect(code);
    setShowLanguagePicker(false);
  };

  return (
    <>
      <View style={styles.container}>
        {/* Main Toggle */}
        <TouchableOpacity
          onPress={handleToggle}
          style={[
            styles.toggle,
            {
              backgroundColor: enabled
                ? isDark
                  ? "rgba(79, 195, 247, 0.2)"
                  : "rgba(0, 122, 255, 0.1)"
                : isDark
                ? "rgba(255,255,255,0.05)"
                : "rgba(0,0,0,0.03)",
              borderColor: enabled
                ? colors.primary
                : isDark
                ? colors.glassBorder
                : "rgba(0, 0, 0, 0.06)",
            },
          ]}
        >
          <Languages size={18} color={enabled ? colors.primary : colors.textSecondary} />
          <Text
            style={[
              styles.toggleText,
              { color: enabled ? colors.primary : colors.textSecondary },
            ]}
          >
            {enabled ? "Translating" : "Translate"}
          </Text>
        </TouchableOpacity>

        {/* Language Selector (only when enabled) */}
        {enabled && (
          <TouchableOpacity
            onPress={() => setShowLanguagePicker(true)}
            style={[
              styles.languageSelector,
              {
                backgroundColor: hasLanguageSelected
                  ? (isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)")
                  : (isDark ? "rgba(79, 195, 247, 0.2)" : "rgba(0, 122, 255, 0.15)"),
                borderColor: hasLanguageSelected
                  ? (isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.06)")
                  : colors.primary,
              },
            ]}
          >
            {hasLanguageSelected ? (
              <>
                <Text style={styles.flag}>{selectedLang!.flag}</Text>
                <Text style={[styles.languageName, { color: colors.text }]} numberOfLines={1}>
                  {selectedLang!.name}
                </Text>
                <ChevronDown size={14} color={colors.textSecondary} />
              </>
            ) : (
              <>
                <Languages size={16} color={colors.primary} />
                <Text style={[styles.languageName, { color: colors.primary, fontWeight: "600" }]} numberOfLines={1}>
                  Choose Language
                </Text>
                <ChevronDown size={14} color={colors.primary} />
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Language Picker Modal */}
      <Modal
        visible={showLanguagePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowLanguagePicker(false)}
      >
        <BlurView
          intensity={isDark ? 40 : 20}
          tint={isDark ? "dark" : "light"}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            style={styles.modalBackdrop}
            activeOpacity={1}
            onPress={() => setShowLanguagePicker(false)}
          />

          <View
            style={[
              styles.pickerModal,
              {
                backgroundColor: isDark ? colors.cardBackground : "#fff",
                borderColor: isDark ? colors.glassBorder : "rgba(0, 0, 0, 0.08)",
              },
            ]}
          >
            <View style={styles.pickerHeader}>
              <Text style={[styles.pickerTitle, { color: colors.text }]}>
                Translate To
              </Text>
              <TouchableOpacity onPress={() => setShowLanguagePicker(false)}>
                <X size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {LANGUAGES.map((lang) => {
                const isSelected = lang.code === selectedLanguage;
                return (
                  <TouchableOpacity
                    key={lang.code}
                    onPress={() => handleLanguageSelect(lang.code)}
                    style={[
                      styles.languageItem,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? "rgba(79, 195, 247, 0.15)"
                            : "rgba(0, 122, 255, 0.08)"
                          : "transparent",
                      },
                    ]}
                  >
                    <Text style={styles.langFlag}>{lang.flag}</Text>
                    <Text
                      style={[
                        styles.langName,
                        {
                          color: isSelected ? colors.primary : colors.text,
                          fontWeight: isSelected ? "600" : "400",
                        },
                      ]}
                    >
                      {lang.name}
                    </Text>
                    {isSelected && (
                      <View style={[styles.checkIcon, { backgroundColor: colors.primary }]}>
                        <Check size={12} color="#fff" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </BlurView>
      </Modal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  toggle: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
  },
  toggleText: {
    fontSize: 13,
    fontWeight: "600",
  },
  languageSelector: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 20,
    borderWidth: 1,
    gap: 6,
    maxWidth: 140,
  },
  flag: {
    fontSize: 16,
  },
  languageName: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
  },
  pickerModal: {
    width: SCREEN_WIDTH - 60,
    maxHeight: 400,
    borderRadius: 20,
    borderWidth: 1,
    overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  pickerTitle: {
    fontSize: 18,
    fontWeight: "600",
  },
  languageList: {
    maxHeight: 320,
  },
  languageItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 12,
  },
  langFlag: {
    fontSize: 20,
  },
  langName: {
    fontSize: 15,
    flex: 1,
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
});

export default TranslationToggle;

