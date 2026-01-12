/**
 * URL Content Extraction Service
 * 
 * Fetches and extracts readable text content from web pages for AI analysis.
 * This enables the AI to actually "look at" websites and analyze their content.
 */

import * as cheerio from 'cheerio';

export interface URLContentResult {
  url: string;
  title: string | null;
  description: string | null;
  mainContent: string;
  links: Array<{ text: string; href: string }>;
  error: string | null;
  contentType: string | null;
  wordCount: number;
}

/**
 * Extract all URLs from a text string
 */
export function extractURLsFromText(text: string): string[] {
  // Match URLs with common patterns
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  const matches = text.match(urlRegex) || [];
  
  // Clean up URLs (remove trailing punctuation that might have been captured)
  return matches.map(url => {
    // Remove trailing punctuation that's likely not part of the URL
    return url.replace(/[.,;:!?)]+$/, '');
  }).filter((url, index, self) => self.indexOf(url) === index); // Remove duplicates
}

/**
 * Check if user's message is asking about a URL or website
 */
export function isURLAnalysisRequest(text: string): boolean {
  const urlPatterns = [
    /https?:\/\//i,  // Direct URLs
    /\bgo\s+to\b/i,
    /\bcheck\s+out\b/i,
    /\blook\s+at\b/i,
    /\banalyze\s+(this|the|that)\s+(website|site|page|url|link)/i,
    /\bwhat('s|s| is)\s+(on|at)\b.*\.(com|org|net|io|dev|co)/i,
    /\bvisit\b/i,
    /\bopen\b.*\.(com|org|net|io|dev|co)/i,
    /\bsummarize\s+(this|the|that)\s+(website|site|page|article)/i,
    /\bread\s+(this|the|that)\s+(website|site|page|article)/i,
    /\bwhat\s+does\b.*\bsay\b/i,
    /\b(website|site|page|article|blog|post)\b.*\babout\b/i,
  ];
  
  return urlPatterns.some(pattern => pattern.test(text));
}

/**
 * Fetch and extract readable content from a URL
 * @param url - The URL to fetch content from
 * @param maxContentLength - Maximum characters to extract (default 15000)
 * @returns Extracted content or error
 */
export async function extractURLContent(
  url: string, 
  maxContentLength: number = 15000
): Promise<URLContentResult> {
  const result: URLContentResult = {
    url,
    title: null,
    description: null,
    mainContent: '',
    links: [],
    error: null,
    contentType: null,
    wordCount: 0,
  };

  try {
    console.log('[URLExtractor] Fetching content from:', url);

    // Validate URL
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      result.error = 'Invalid URL format';
      return result;
    }

    // Block certain domains that won't work or are problematic
    const blockedDomains = [
      'localhost',
      '127.0.0.1',
      '0.0.0.0',
    ];
    
    if (blockedDomains.some(domain => parsedUrl.hostname.includes(domain))) {
      result.error = 'Cannot access local/private URLs';
      return result;
    }

    // Fetch the URL with a timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity', // Don't compress to simplify parsing
      },
      redirect: 'follow',
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      result.error = `Failed to fetch: HTTP ${response.status} ${response.statusText}`;
      console.error('[URLExtractor]', result.error);
      return result;
    }

    result.contentType = response.headers.get('content-type');

    // Check if it's an HTML page
    if (!result.contentType?.includes('text/html') && !result.contentType?.includes('application/xhtml')) {
      // Handle other content types
      if (result.contentType?.includes('application/json')) {
        const json = await response.text();
        result.mainContent = `JSON Data:\n${json.substring(0, maxContentLength)}`;
        result.wordCount = json.split(/\s+/).length;
        return result;
      } else if (result.contentType?.includes('text/plain')) {
        const text = await response.text();
        result.mainContent = text.substring(0, maxContentLength);
        result.wordCount = text.split(/\s+/).length;
        return result;
      } else if (result.contentType?.includes('application/pdf')) {
        result.error = 'PDF files require specialized processing. Please upload the file directly.';
        return result;
      } else {
        result.error = `Unsupported content type: ${result.contentType}`;
        return result;
      }
    }

    const html = await response.text();
    const $ = cheerio.load(html);

    // Extract title
    result.title = $('meta[property="og:title"]').attr('content')
      || $('meta[name="twitter:title"]').attr('content')
      || $('title').text().trim()
      || null;

    // Extract description
    result.description = $('meta[property="og:description"]').attr('content')
      || $('meta[name="twitter:description"]').attr('content')
      || $('meta[name="description"]').attr('content')
      || null;

    // Remove unwanted elements that don't contain main content
    $('script, style, noscript, iframe, nav, footer, header, aside, .nav, .footer, .header, .sidebar, .advertisement, .ad, .ads, [role="navigation"], [role="banner"], [role="complementary"], form, input, button, select, textarea').remove();
    
    // Also remove hidden elements
    $('[style*="display: none"], [style*="display:none"], [hidden], .hidden').remove();

    // Try to find the main content area
    const mainContentSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '.content',
      '.post-content',
      '.article-content',
      '.entry-content',
      '#content',
      '#main',
      '.prose',
    ];

    let mainElement = null;
    for (const selector of mainContentSelectors) {
      const element = $(selector).first();
      if (element.length && element.text().trim().length > 100) {
        mainElement = element;
        break;
      }
    }

    // If no main content area found, use body
    if (!mainElement) {
      mainElement = $('body');
    }

    // Extract text content
    let textContent = '';
    
    // Get paragraphs and headings
    mainElement.find('p, h1, h2, h3, h4, h5, h6, li, td, th, blockquote, pre, code').each((_, elem) => {
      const text = $(elem).text().trim();
      if (text.length > 0) {
        // Add appropriate formatting based on element type
        const tagName = elem.tagName?.toLowerCase();
        if (tagName?.startsWith('h')) {
          textContent += `\n\n## ${text}\n`;
        } else if (tagName === 'li') {
          textContent += `\n• ${text}`;
        } else if (tagName === 'blockquote') {
          textContent += `\n> ${text}\n`;
        } else if (tagName === 'pre' || tagName === 'code') {
          textContent += `\n\`\`\`\n${text}\n\`\`\`\n`;
        } else {
          textContent += `\n${text}`;
        }
      }
    });

    // Clean up the text
    textContent = textContent
      .replace(/\n{3,}/g, '\n\n') // Remove excessive newlines
      .replace(/[ \t]+/g, ' ') // Normalize spaces
      .trim();

    // If we didn't get much content from structured elements, try getting all text
    if (textContent.length < 200) {
      textContent = mainElement.text()
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Truncate if too long
    if (textContent.length > maxContentLength) {
      textContent = textContent.substring(0, maxContentLength) + '\n\n[Content truncated due to length...]';
    }

    result.mainContent = textContent;
    result.wordCount = textContent.split(/\s+/).filter(w => w.length > 0).length;

    // Extract important links (limit to 10)
    const links: Array<{ text: string; href: string }> = [];
    mainElement.find('a[href]').each((_, elem) => {
      if (links.length >= 10) return false; // Stop after 10 links
      
      const href = $(elem).attr('href');
      const text = $(elem).text().trim();
      
      if (href && text && text.length > 2 && text.length < 100) {
        // Make relative URLs absolute
        let absoluteHref = href;
        if (href.startsWith('/')) {
          absoluteHref = `${parsedUrl.origin}${href}`;
        } else if (!href.startsWith('http')) {
          absoluteHref = `${parsedUrl.origin}/${href}`;
        }
        
        // Skip anchors and javascript links
        if (!href.startsWith('#') && !href.startsWith('javascript:')) {
          links.push({ text, href: absoluteHref });
        }
      }
    });
    result.links = links;

    console.log('[URLExtractor] Successfully extracted content:', {
      url,
      title: result.title,
      wordCount: result.wordCount,
      contentLength: result.mainContent.length,
    });

    return result;

  } catch (error: any) {
    console.error('[URLExtractor] Error extracting content:', error);
    
    if (error.name === 'AbortError') {
      result.error = 'Request timed out - the website took too long to respond';
    } else if (error.code === 'ENOTFOUND') {
      result.error = 'Website not found - please check the URL';
    } else if (error.code === 'ECONNREFUSED') {
      result.error = 'Connection refused - the website may be down';
    } else {
      result.error = error.message || 'Failed to extract content from URL';
    }
    
    return result;
  }
}

/**
 * Extract content from multiple URLs
 * @param urls - Array of URLs to extract content from
 * @param maxContentPerURL - Maximum content per URL
 * @returns Array of extraction results
 */
export async function extractMultipleURLs(
  urls: string[],
  maxContentPerURL: number = 10000
): Promise<URLContentResult[]> {
  // Limit to 3 URLs to avoid overwhelming the AI with too much content
  const urlsToProcess = urls.slice(0, 3);
  
  console.log(`[URLExtractor] Processing ${urlsToProcess.length} URL(s)`);
  
  // Process URLs in parallel
  const results = await Promise.all(
    urlsToProcess.map(url => extractURLContent(url, maxContentPerURL))
  );
  
  return results;
}

/**
 * Format extracted URL content for inclusion in AI prompt
 */
export function formatURLContentForPrompt(results: URLContentResult[]): string {
  if (results.length === 0) return '';
  
  const sections: string[] = [];
  
  for (const result of results) {
    if (result.error) {
      sections.push(`**[Website: ${result.url}]**\nError: ${result.error}\n`);
    } else {
      let section = `**[Website: ${result.url}]**\n`;
      if (result.title) {
        section += `Title: ${result.title}\n`;
      }
      if (result.description) {
        section += `Description: ${result.description}\n`;
      }
      section += `\n${result.mainContent}\n`;
      
      if (result.links.length > 0) {
        section += `\nKey links on this page:\n`;
        result.links.slice(0, 5).forEach(link => {
          section += `- ${link.text}: ${link.href}\n`;
        });
      }
      
      sections.push(section);
    }
  }
  
  return `\n---\n**WEBSITE CONTENT FOR ANALYSIS:**\n${sections.join('\n---\n')}\n---\n`;
}
