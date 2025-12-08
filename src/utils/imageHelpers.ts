import { BACKEND_URL } from "@/lib/api";

/**
 * Convert an image URL to a full URL
 * Handles relative URLs, full URLs, Supabase storage URLs, and corrupted double-prepended URLs
 */
export const getFullImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return "";
  
  // FIX: Handle corrupted URLs that have been double-prepended
  // e.g., "https://backend.comhttps://supabase.co/storage/..."
  const supabaseUrlMatch = imageUrl.match(/(https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/public\/.+)/);
  if (supabaseUrlMatch) {
    // Extract and return the clean Supabase URL
    return supabaseUrlMatch[1];
  }
  
  // If already a full URL
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const url = new URL(imageUrl);
      
      // Check if this is a Supabase storage URL - if so, return as-is
      if (url.pathname.includes('/storage/v1/object/')) {
        return imageUrl;
      }
      
      // For other full URLs (e.g., old backend URLs), extract path and use current BACKEND_URL
      // This handles cases where the URL was saved with a different backend URL
      return `${BACKEND_URL}${url.pathname}`;
    } catch {
      // If URL parsing fails, return as is
      return imageUrl;
    }
  }
  
  // Convert relative URL to full URL
  return `${BACKEND_URL}${imageUrl}`;
};

