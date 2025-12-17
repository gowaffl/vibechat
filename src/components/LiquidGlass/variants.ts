// Liquid Glass color variants for AI Super Features
// Inspired by OpenAI, Tesla, and Apple aesthetics

export type LiquidGlassVariant = 
  | "default" 
  | "success" 
  | "warning" 
  | "danger" 
  | "info"
  | "catchup"    // Smart Catch-Up - Warm amber
  | "event"      // Event Intelligence - Electric blue
  | "reactor"    // Content Reactor - Vibrant purple
  | "thread";    // Smart Threads - Fresh teal

export interface VariantColors {
  borderColor: string;
  shadowColor: string;
  gradientColors: readonly [string, string, string];
  iconColor: string;
  textColor: string;
}

const darkVariants: Record<LiquidGlassVariant, VariantColors> = {
  default: {
    borderColor: "rgba(255, 255, 255, 0.2)",
    shadowColor: "rgba(255, 255, 255, 0.3)",
    gradientColors: [
      "rgba(255, 255, 255, 0.1)",
      "rgba(255, 255, 255, 0.05)",
      "rgba(255, 255, 255, 0.02)",
    ],
    iconColor: "#FFFFFF",
    textColor: "#FFFFFF",
  },
  success: {
    borderColor: "rgba(52, 199, 89, 0.4)",
    shadowColor: "rgba(52, 199, 89, 0.5)",
    gradientColors: [
      "rgba(52, 199, 89, 0.15)",
      "rgba(52, 199, 89, 0.1)",
      "rgba(52, 199, 89, 0.05)",
    ],
    iconColor: "#34C759",
    textColor: "#34C759",
  },
  warning: {
    borderColor: "rgba(255, 204, 0, 0.4)",
    shadowColor: "rgba(255, 204, 0, 0.5)",
    gradientColors: [
      "rgba(255, 204, 0, 0.15)",
      "rgba(255, 204, 0, 0.1)",
      "rgba(255, 204, 0, 0.05)",
    ],
    iconColor: "#FFCC00",
    textColor: "#FFCC00",
  },
  danger: {
    borderColor: "rgba(255, 59, 48, 0.4)",
    shadowColor: "rgba(255, 59, 48, 0.5)",
    gradientColors: [
      "rgba(255, 59, 48, 0.15)",
      "rgba(255, 59, 48, 0.1)",
      "rgba(255, 59, 48, 0.05)",
    ],
    iconColor: "#FF3B30",
    textColor: "#FF3B30",
  },
  info: {
    borderColor: "rgba(0, 122, 255, 0.4)",
    shadowColor: "rgba(0, 122, 255, 0.5)",
    gradientColors: [
      "rgba(0, 122, 255, 0.15)",
      "rgba(0, 122, 255, 0.1)",
      "rgba(0, 122, 255, 0.05)",
    ],
    iconColor: "#007AFF",
    textColor: "#007AFF",
  },
  // AI Super Features variants
  catchup: {
    borderColor: "rgba(255, 144, 82, 0.45)",
    shadowColor: "rgba(255, 144, 82, 0.6)",
    gradientColors: [
      "rgba(255, 144, 82, 0.18)",
      "rgba(255, 107, 43, 0.12)",
      "rgba(255, 107, 43, 0.06)",
    ],
    iconColor: "#FF9052",
    textColor: "#FFB380",
  },
  event: {
    borderColor: "rgba(0, 122, 255, 0.5)",
    shadowColor: "rgba(10, 149, 255, 0.6)",
    gradientColors: [
      "rgba(10, 149, 255, 0.2)",
      "rgba(0, 122, 255, 0.14)",
      "rgba(0, 122, 255, 0.08)",
    ],
    iconColor: "#0A95FF",
    textColor: "#3DAFFF",
  },
  reactor: {
    borderColor: "rgba(168, 85, 247, 0.5)",
    shadowColor: "rgba(168, 85, 247, 0.6)",
    gradientColors: [
      "rgba(168, 85, 247, 0.2)",
      "rgba(147, 51, 234, 0.14)",
      "rgba(147, 51, 234, 0.08)",
    ],
    iconColor: "#A855F7",
    textColor: "#C084FC",
  },
  thread: {
    borderColor: "rgba(20, 184, 166, 0.5)",
    shadowColor: "rgba(20, 184, 166, 0.6)",
    gradientColors: [
      "rgba(20, 184, 166, 0.2)",
      "rgba(13, 148, 136, 0.14)",
      "rgba(13, 148, 136, 0.08)",
    ],
    iconColor: "#14B8A6",
    textColor: "#2DD4BF",
  },
};

const lightVariants: Record<LiquidGlassVariant, VariantColors> = {
  default: {
    borderColor: "rgba(226, 232, 240, 0.6)",
    shadowColor: "rgba(0, 0, 0, 0.05)",
    gradientColors: [
      "rgba(255, 255, 255, 0.8)",
      "rgba(255, 255, 255, 0.6)",
      "rgba(255, 255, 255, 0.4)",
    ],
    iconColor: "#1A1A1A",
    textColor: "#1A1A1A",
  },
  success: {
    borderColor: "rgba(52, 199, 89, 0.3)",
    shadowColor: "rgba(52, 199, 89, 0.2)",
    gradientColors: [
      "rgba(52, 199, 89, 0.1)",
      "rgba(52, 199, 89, 0.05)",
      "rgba(52, 199, 89, 0.02)",
    ],
    iconColor: "#248A3D", // Darker for light mode visibility
    textColor: "#248A3D",
  },
  warning: {
    borderColor: "rgba(255, 149, 0, 0.3)",
    shadowColor: "rgba(255, 149, 0, 0.2)",
    gradientColors: [
      "rgba(255, 149, 0, 0.1)",
      "rgba(255, 149, 0, 0.05)",
      "rgba(255, 149, 0, 0.02)",
    ],
    iconColor: "#CC7700",
    textColor: "#CC7700",
  },
  danger: {
    borderColor: "rgba(255, 59, 48, 0.3)",
    shadowColor: "rgba(255, 59, 48, 0.2)",
    gradientColors: [
      "rgba(255, 59, 48, 0.1)",
      "rgba(255, 59, 48, 0.05)",
      "rgba(255, 59, 48, 0.02)",
    ],
    iconColor: "#D12A22",
    textColor: "#D12A22",
  },
  info: {
    borderColor: "rgba(0, 122, 255, 0.3)",
    shadowColor: "rgba(0, 122, 255, 0.2)",
    gradientColors: [
      "rgba(0, 122, 255, 0.1)",
      "rgba(0, 122, 255, 0.05)",
      "rgba(0, 122, 255, 0.02)",
    ],
    iconColor: "#0056B3",
    textColor: "#0056B3",
  },
  // AI Super Features variants
  catchup: {
    borderColor: "rgba(255, 144, 82, 0.3)",
    shadowColor: "rgba(255, 144, 82, 0.2)",
    gradientColors: [
      "rgba(255, 144, 82, 0.1)",
      "rgba(255, 144, 82, 0.05)",
      "rgba(255, 144, 82, 0.02)",
    ],
    iconColor: "#E66A2C",
    textColor: "#E66A2C",
  },
  event: {
    borderColor: "rgba(0, 122, 255, 0.3)",
    shadowColor: "rgba(0, 122, 255, 0.2)",
    gradientColors: [
      "rgba(0, 122, 255, 0.1)",
      "rgba(0, 122, 255, 0.05)",
      "rgba(0, 122, 255, 0.02)",
    ],
    iconColor: "#0062CC",
    textColor: "#0062CC",
  },
  reactor: {
    borderColor: "rgba(168, 85, 247, 0.3)",
    shadowColor: "rgba(168, 85, 247, 0.2)",
    gradientColors: [
      "rgba(168, 85, 247, 0.1)",
      "rgba(168, 85, 247, 0.05)",
      "rgba(168, 85, 247, 0.02)",
    ],
    iconColor: "#7E22CE",
    textColor: "#7E22CE",
  },
  thread: {
    borderColor: "rgba(20, 184, 166, 0.3)",
    shadowColor: "rgba(20, 184, 166, 0.2)",
    gradientColors: [
      "rgba(20, 184, 166, 0.1)",
      "rgba(20, 184, 166, 0.05)",
      "rgba(20, 184, 166, 0.02)",
    ],
    iconColor: "#0F766E",
    textColor: "#0F766E",
  },
};

export const getVariantColors = (variant: LiquidGlassVariant, isDark: boolean): VariantColors => {
  return isDark ? darkVariants[variant] : lightVariants[variant];
};

// Default export for backward compatibility (defaults to dark)
export const variantColorMap = darkVariants;
