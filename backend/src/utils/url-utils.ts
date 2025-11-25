/**
 * URL utility functions for link preview
 */

// Regular expression to detect URLs in text
const URL_REGEX = /(https?:\/\/[^\s]+)/gi;

/**
 * Extract the first URL from a text message
 * @param text - The message text
 * @returns The first URL found, or null if no URL exists
 */
export function extractFirstUrl(text: string): string | null {
  const matches = text.match(URL_REGEX);
  return matches ? matches[0] : null;
}

/**
 * Extract all URLs from a text message
 * @param text - The message text
 * @returns Array of URLs found
 */
export function extractAllUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  return matches || [];
}

/**
 * Check if text contains at least one URL
 * @param text - The message text
 * @returns true if text contains a URL
 */
export function containsUrl(text: string): boolean {
  return URL_REGEX.test(text);
}
