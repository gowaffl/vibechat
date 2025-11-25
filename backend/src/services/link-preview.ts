/**
 * Link Preview Service
 * Fetches and parses Open Graph and Twitter Card metadata from URLs
 */

import * as cheerio from 'cheerio';

export interface LinkPreviewData {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
}

/**
 * Fetch link preview metadata from a URL
 * @param url - The URL to fetch metadata from
 * @returns Link preview data or null if failed
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreviewData | null> {
  try {
    console.log('[LinkPreview] Fetching metadata for:', url);

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; LinkPreviewBot/1.0)',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[LinkPreview] Failed to fetch URL:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (!contentType?.includes('text/html')) {
      console.log('[LinkPreview] Not an HTML page, skipping:', contentType);
      return null;
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract Open Graph metadata (preferred)
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');

    // Extract Twitter Card metadata (fallback)
    const twitterTitle = $('meta[name="twitter:title"]').attr('content');
    const twitterDescription = $('meta[name="twitter:description"]').attr('content');
    const twitterImage = $('meta[name="twitter:image"]').attr('content');

    // Extract standard HTML metadata (second fallback)
    const htmlTitle = $('title').text();
    const metaDescription = $('meta[name="description"]').attr('content');

    // Extract favicon
    let favicon = $('link[rel="icon"]').attr('href')
                  || $('link[rel="shortcut icon"]').attr('href')
                  || $('link[rel="apple-touch-icon"]').attr('href');

    // Make favicon absolute if it's relative
    if (favicon && !favicon.startsWith('http')) {
      const urlObj = new URL(url);
      if (favicon.startsWith('//')) {
        favicon = `${urlObj.protocol}${favicon}`;
      } else if (favicon.startsWith('/')) {
        favicon = `${urlObj.origin}${favicon}`;
      } else {
        favicon = `${urlObj.origin}/${favicon}`;
      }
    }

    // Make image absolute if it's relative
    let finalImage = ogImage || twitterImage;
    if (finalImage && !finalImage.startsWith('http')) {
      const urlObj = new URL(url);
      if (finalImage.startsWith('//')) {
        finalImage = `${urlObj.protocol}${finalImage}`;
      } else if (finalImage.startsWith('/')) {
        finalImage = `${urlObj.origin}${finalImage}`;
      } else {
        finalImage = `${urlObj.origin}/${finalImage}`;
      }
    }

    const previewData: LinkPreviewData = {
      url,
      title: ogTitle || twitterTitle || htmlTitle || null,
      description: ogDescription || twitterDescription || metaDescription || null,
      image: finalImage || null,
      siteName: ogSiteName || new URL(url).hostname || null,
      favicon: favicon || null,
    };

    console.log('[LinkPreview] Successfully extracted metadata:', previewData);
    return previewData;

  } catch (error) {
    console.error('[LinkPreview] Error fetching link preview:', error);
    return null;
  }
}
