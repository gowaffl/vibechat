/** @type {import('tailwindcss').Config} */
const plugin = require("tailwindcss/plugin");

module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./App.tsx", "./app/**/*.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  corePlugins: {
    space: false,
  },
  theme: {
    // NOTE to AI: You can extend the theme with custom colors or styles here.
    extend: {
      // AI Super Features color palette (OpenAI/Tesla/Apple inspired)
      colors: {
        // Smart Catch-Up - Warm amber gradient
        catchup: {
          50: "#FFF9F5",
          100: "#FFF4EB",
          200: "#FFE8D6",
          300: "#FFD7B8",
          400: "#FFB380",
          500: "#FF9052",
          600: "#FF6B2B",
          700: "#E55A1F",
          800: "#B84718",
        },
        // Event Intelligence - Electric blue gradient
        event: {
          50: "#F0F8FF",
          100: "#E0F1FF",
          200: "#BAE0FF",
          300: "#7CC8FF",
          400: "#3DAFFF",
          500: "#0A95FF",
          600: "#007AFF",
          700: "#0063CC",
          800: "#004D99",
        },
        // Content Reactor - Vibrant purple gradient
        reactor: {
          50: "#FAF5FF",
          100: "#F3EBFF",
          200: "#E9D5FF",
          300: "#D8B4FE",
          400: "#C084FC",
          500: "#A855F7",
          600: "#9333EA",
          700: "#7C3AED",
          800: "#6B21A8",
        },
        // Smart Threads - Fresh green gradient
        thread: {
          50: "#F0FDF9",
          100: "#CCFBEF",
          200: "#99F6E0",
          300: "#5EEAD4",
          400: "#2DD4BF",
          500: "#14B8A6",
          600: "#0D9488",
          700: "#0F766E",
          800: "#115E59",
        },
      },
      fontSize: {
        xs: "10px",
        sm: "12px",
        base: "14px",
        lg: "18px",
        xl: "20px",
        "2xl": "24px",
        "3xl": "32px",
        "4xl": "40px",
        "5xl": "48px",
        "6xl": "56px",
        "7xl": "64px",
        "8xl": "72px",
        "9xl": "80px",
      },
    },
  },
  darkMode: "class",
  plugins: [
    plugin(({ matchUtilities, theme }) => {
      const spacing = theme("spacing");

      // space-{n}  ->  gap: {n}
      matchUtilities(
        { space: (value) => ({ gap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] },
      );

      // space-x-{n}  ->  column-gap: {n}
      matchUtilities(
        { "space-x": (value) => ({ columnGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] },
      );

      // space-y-{n}  ->  row-gap: {n}
      matchUtilities(
        { "space-y": (value) => ({ rowGap: value }) },
        { values: spacing, type: ["length", "number", "percentage"] },
      );
    }),
  ],
};
