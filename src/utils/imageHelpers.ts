import { BACKEND_URL } from "@/lib/api";

/**
 * Convert an image URL to a full URL
 * Handles relative URLs, full URLs, Supabase storage URLs (signed & public), and corrupted double-prepended URLs
 * Converts expired signed URLs to public URLs (since bucket is now public)
 */
export const getFullImageUrl = (imageUrl: string | null | undefined): string => {
  if (!imageUrl) return "";
  
  // FIX: Handle corrupted URLs that have been double-prepended
  // e.g., "https://backend.comhttps://supabase.co/storage/..."
  const supabaseUrlMatch = imageUrl.match(/(https:\/\/[^/]+\.supabase\.co\/storage\/v1\/object\/.+)/);
  if (supabaseUrlMatch) {
    const cleanUrl = supabaseUrlMatch[1];
    
    // Convert signed URLs to public URLs (signed URLs expire after 24 hours)
    // e.g., /storage/v1/object/sign/uploads/file.jpg?token=... → /storage/v1/object/public/uploads/file.jpg
    if (cleanUrl.includes('/sign/uploads/')) {
      const signedUrlObj = new URL(cleanUrl);
      const pathMatch = signedUrlObj.pathname.match(/\/storage\/v1\/object\/sign\/uploads\/(.+)/);
      if (pathMatch) {
        const filename = pathMatch[1];
        const baseUrl = `${signedUrlObj.protocol}//${signedUrlObj.host}`;
        return `${baseUrl}/storage/v1/object/public/uploads/${filename}`;
      }
    }
    
    return cleanUrl;
  }
  
  // If already a full URL
  if (imageUrl.startsWith("http://") || imageUrl.startsWith("https://")) {
    try {
      const url = new URL(imageUrl);
      
      // Check if this is a Supabase signed URL - convert to public
      if (url.pathname.includes('/storage/v1/object/sign/uploads/')) {
        const pathMatch = url.pathname.match(/\/storage\/v1\/object\/sign\/uploads\/(.+)/);
        if (pathMatch) {
          const filename = pathMatch[1];
          const baseUrl = `${url.protocol}//${url.host}`;
          return `${baseUrl}/storage/v1/object/public/uploads/${filename}`;
        }
      }
      
      // Check if this is already a Supabase public URL - return as-is
      if (url.pathname.includes('/storage/v1/object/public/uploads/')) {
        return imageUrl;
      }
      
      // For other storage URLs
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

