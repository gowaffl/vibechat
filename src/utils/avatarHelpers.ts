/**
 * Helper functions for generating user avatar initials and colors
 */

/**
 * Generate initials from a user's name
 * @param name - The user's name
 * @returns Initials (2 characters max)
 */
export const getInitials = (name: string | undefined | null): string => {
  if (!name) return "?";
  
  const trimmedName = name.trim();
  if (!trimmedName) return "?";
  
  const words = trimmedName.split(/\s+/);
  
  if (words.length === 1) {
    // Single word: take first 2 characters
    return words[0].substring(0, 2).toUpperCase();
  }
  
  // Multiple words: take first letter of first and last word
  const firstInitial = words[0][0];
  const lastInitial = words[words.length - 1][0];
  return (firstInitial + lastInitial).toUpperCase();
};

/**
 * Generate a consistent color from a user's name
 * @param name - The user's name
 * @returns Hex color code
 */
export const getColorFromName = (name: string | undefined | null): string => {
  if (!name) return "#8E8E93";
  
  // Generate a hash from the name
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Use the hash to pick from a set of pleasant colors
  const colors = [
    "#FF6B6B", // Coral red
    "#4ECDC4", // Turquoise
    "#45B7D1", // Sky blue
    "#FFA07A", // Light salmon
    "#98D8C8", // Mint
    "#F7DC6F", // Warm yellow
    "#BB8FCE", // Lavender
    "#85C1E2", // Light blue
    "#F8B195", // Peach
    "#6C5CE7", // Purple
    "#A29BFE", // Periwinkle
    "#FD79A8", // Pink
    "#FDCB6E", // Sunflower
    "#00B894", // Emerald
    "#E17055", // Terra cotta
  ];
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

