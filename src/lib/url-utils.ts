/**
 * URL utility functions for link preview (frontend)
 * Mirrors backend/src/utils/url-utils.ts for consistent URL detection
 */

// Regular expression to detect URLs in text
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

/**
 * Clean a URL by removing trailing punctuation
 */
function cleanUrl(url: string): string {
  return url.replace(/[.,;!?)]+$/, "");
}

/**
 * Extract the first URL from a text message
 * @param text - The message text
 * @returns The first URL found, or null if no URL exists
 */
export function extractFirstUrl(text: string): string | null {
  const matches = text.match(URL_REGEX);
  return matches ? cleanUrl(matches[0]) : null;
}

/**
 * Extract all URLs from a text message
 * @param text - The message text
 * @returns Array of URLs found
 */
export function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches ? matches.map(cleanUrl) : [];
}

/**
 * Check if text contains at least one URL
 * @param text - The message text
 * @returns true if text contains a URL
 */
export function containsUrl(text: string): boolean {
  return URL_REGEX.test(text);
}

