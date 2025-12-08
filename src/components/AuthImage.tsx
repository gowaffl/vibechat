import React, { useState, useEffect } from 'react';
import { Image as ExpoImage, ImageProps as ExpoImageProps } from 'expo-image';
import { getAuthenticatedImageUrl } from '@/utils/imageHelpers';

/**
 * Authenticated Image Component
 * 
 * A wrapper around expo-image that automatically handles authentication
 * for images that require RLS validation. Use this for:
 * - User profile images
 * - Chat images
 * - Any images from Supabase storage with RLS
 * 
 * Usage:
 * <AuthImage source={{ uri: imageUrl }} style={{ width: 100, height: 100 }} />
 */
interface AuthImageProps extends Omit<ExpoImageProps, 'source'> {
  source: { uri: string | null | undefined } | number | string;
}

export const AuthImage: React.FC<AuthImageProps> = ({ source, ...props }) => {
  const [authenticatedUri, setAuthenticatedUri] = useState<string>('');

  useEffect(() => {
    const loadAuthenticatedUrl = async () => {
      // Handle different source types
      if (typeof source === 'object' && 'uri' in source) {
        const authUrl = await getAuthenticatedImageUrl(source.uri);
        setAuthenticatedUri(authUrl);
      } else if (typeof source === 'string') {
        const authUrl = await getAuthenticatedImageUrl(source);
        setAuthenticatedUri(authUrl);
      }
      // If source is a number (local require), we don't need to authenticate
    };

    loadAuthenticatedUrl();
  }, [source]);

  // Handle local images (require statements)
  if (typeof source === 'number') {
    return <ExpoImage source={source} {...props} />;
  }

  // Handle string URIs directly
  if (typeof source === 'string' && !source.startsWith('http')) {
    return <ExpoImage source={source as any} {...props} />;
  }

  // For authenticated URLs, wait until we have the auth token
  if (!authenticatedUri) {
    // Return a placeholder or empty image while loading
    return <ExpoImage source={null as any} {...props} />;
  }

  return <ExpoImage source={{ uri: authenticatedUri }} {...props} />;
};

