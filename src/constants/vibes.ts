import { Vibe } from "@shared/contracts";
import { Heart, Zap, ShieldAlert, HelpCircle, PartyPopper, LucideIcon } from "lucide-react-native";

export interface VibeDefinition {
  key: Vibe;
  label: string;
  icon: LucideIcon;
  color: string;
  secondaryColor: string;
  description: string;
  animationType: "pulse" | "bounce" | "shake" | "glow" | "none";
}

export const VIBES: Record<Vibe, VibeDefinition> = {
  genuine: {
    key: "genuine",
    label: "Genuine",
    icon: Heart,
    color: "#F59E0B", // Amber-500
    secondaryColor: "#FEF3C7", // Amber-100
    description: "Warm, sincere, and heartfelt",
    animationType: "pulse", // Gentle pulse
  },
  playful: {
    key: "playful",
    label: "Playful",
    icon: PartyPopper,
    color: "#EC4899", // Pink-500
    secondaryColor: "#FCE7F3", // Pink-100
    description: "Joking, fun, not serious",
    animationType: "bounce", // Bouncy
  },
  serious: {
    key: "serious",
    label: "Serious",
    icon: ShieldAlert,
    color: "#3B82F6", // Blue-500
    secondaryColor: "#DBEAFE", // Blue-100
    description: "Important, direct, no jokes",
    animationType: "none", // Solid, stable
  },
  unsure: {
    key: "unsure",
    label: "Unsure",
    icon: HelpCircle,
    color: "#9CA3AF", // Gray-400
    secondaryColor: "#F3F4F6", // Gray-100
    description: "Confused, asking, hesitant",
    animationType: "shake", // Slight shake/wobble
  },
  excited: {
    key: "excited",
    label: "Excited",
    icon: Zap,
    color: "#8B5CF6", // Violet-500
    secondaryColor: "#EDE9FE", // Violet-100
    description: "Hyped, loud, high energy",
    animationType: "glow", // Fast pulse / shimmer
  },
};

export const VIBE_KEYS = Object.keys(VIBES) as Vibe[];

