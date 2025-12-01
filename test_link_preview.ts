
import * as cheerio from 'cheerio';

async function fetchLinkPreview(url: string) {
  try {
    console.log('[LinkPreview] Fetching metadata for:', url);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      console.error('[LinkPreview] Failed to fetch URL:', response.status);
      return null;
    }

    const contentType = response.headers.get('content-type');
    console.log('[LinkPreview] Content-Type:', contentType);
    
    const html = await response.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDescription = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');
    const ogSiteName = $('meta[property="og:site_name"]').attr('content');
    
    const title = ogTitle || $('title').text();
    
    console.log('Result:', {
        title,
        ogTitle,
        ogDescription, 
        ogImage,
        ogSiteName
    });

  } catch (error) {
    console.error('[LinkPreview] Error:', error);
  }
}

// Test the reported URLs
console.log('Testing truegraceofgod.org...');
fetchLinkPreview('https://truegraceofgod.org');

console.log('Testing founders.org...');
fetchLinkPreview('https://founders.org');

