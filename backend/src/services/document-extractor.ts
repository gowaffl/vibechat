/**
 * Document Extraction Service
 * 
 * Extracts text content from various document types for AI analysis.
 * Supports PDF, CSV, and plain text files.
 * 
 * Note: For full Office document support (docx, xlsx), additional packages
 * would be needed (mammoth, xlsx). Currently these are handled as binary
 * with a helpful message to the user.
 */

export interface DocumentExtractionResult {
  filename: string;
  mimeType: string;
  content: string;
  metadata: {
    wordCount: number;
    pageCount?: number;
    truncated: boolean;
  };
  error: string | null;
}

export interface ExtractableFile {
  name: string;
  mimeType: string;
  base64?: string;
}

// Supported MIME types and their extraction methods
const SUPPORTED_TEXT_TYPES = [
  'text/plain',
  'text/csv',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
];

const SUPPORTED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
  'application/vnd.ms-excel', // xls
  'application/msword', // doc
];

const IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
];

/**
 * Check if a file is a text-based document that can be extracted
 */
export function isExtractableDocument(mimeType: string): boolean {
  return SUPPORTED_TEXT_TYPES.some(t => mimeType.includes(t)) ||
         SUPPORTED_DOCUMENT_TYPES.some(t => mimeType.includes(t));
}

/**
 * Check if a file is an image (handled separately by AI vision)
 */
export function isImageFile(mimeType: string): boolean {
  return IMAGE_TYPES.some(t => mimeType.includes(t));
}

/**
 * Extract text content from a base64-encoded file
 */
export async function extractDocumentContent(
  file: ExtractableFile,
  maxContentLength: number = 50000
): Promise<DocumentExtractionResult> {
  const result: DocumentExtractionResult = {
    filename: file.name,
    mimeType: file.mimeType,
    content: '',
    metadata: {
      wordCount: 0,
      truncated: false,
    },
    error: null,
  };

  try {
    if (!file.base64) {
      result.error = 'No file content provided';
      return result;
    }

    const buffer = Buffer.from(file.base64, 'base64');
    console.log(`[DocExtractor] Processing ${file.name} (${file.mimeType}, ${buffer.length} bytes)`);

    // Handle different file types
    if (file.mimeType.includes('text/') || file.mimeType === 'application/json' || file.mimeType.includes('xml')) {
      // Plain text files can be directly decoded
      result.content = buffer.toString('utf-8');
    } else if (file.mimeType.includes('csv')) {
      // CSV files - format nicely for AI understanding
      result.content = formatCSVForAI(buffer.toString('utf-8'));
    } else if (file.mimeType === 'application/pdf') {
      // PDF extraction
      result.content = await extractPDFContent(buffer);
      result.metadata.pageCount = estimatePDFPages(buffer);
    } else if (file.mimeType.includes('spreadsheet') || file.mimeType.includes('excel')) {
      // Excel files - provide helpful message
      result.content = `[This is a spreadsheet file (${file.name}). To analyze spreadsheet data, please export it as CSV and upload that instead, or copy the relevant data as text.]`;
      result.error = 'Spreadsheet files require CSV export for full analysis';
    } else if (file.mimeType.includes('wordprocessing') || file.mimeType.includes('msword')) {
      // Word documents - try basic text extraction
      result.content = await extractBasicTextFromBinary(buffer, file.name);
      if (!result.content) {
        result.content = `[This is a Word document (${file.name}). For best results, please copy the relevant text from the document or export it as a text file.]`;
        result.error = 'Word document text extraction limited';
      }
    } else {
      result.error = `Unsupported file type: ${file.mimeType}`;
      result.content = `[Cannot extract text from ${file.name}. File type ${file.mimeType} is not supported for text extraction.]`;
    }

    // Truncate if too long
    if (result.content.length > maxContentLength) {
      result.content = result.content.substring(0, maxContentLength) + '\n\n[Content truncated due to length...]';
      result.metadata.truncated = true;
    }

    // Calculate word count
    result.metadata.wordCount = result.content.split(/\s+/).filter(w => w.length > 0).length;

    console.log(`[DocExtractor] Extracted ${result.metadata.wordCount} words from ${file.name}`);
    return result;

  } catch (error: any) {
    console.error(`[DocExtractor] Error extracting ${file.name}:`, error);
    result.error = error.message || 'Failed to extract document content';
    result.content = `[Error extracting content from ${file.name}: ${result.error}]`;
    return result;
  }
}

/**
 * Format CSV data for better AI understanding
 */
function formatCSVForAI(csvContent: string): string {
  const lines = csvContent.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return '[Empty CSV file]';
  }

  // Parse header
  const header = lines[0] || '';
  const columns = parseCSVLine(header);
  
  let formatted = `**CSV Data (${lines.length - 1} rows, ${columns.length} columns)**\n\n`;
  formatted += `**Columns:** ${columns.join(', ')}\n\n`;
  
  // Show first few rows as sample
  const sampleRows = Math.min(10, lines.length - 1);
  if (sampleRows > 0) {
    formatted += `**Sample Data (first ${sampleRows} rows):**\n`;
    
    for (let i = 1; i <= sampleRows; i++) {
      const rowData = parseCSVLine(lines[i] || '');
      formatted += `\nRow ${i}:\n`;
      columns.forEach((col, idx) => {
        formatted += `  ${col}: ${rowData[idx] || '(empty)'}\n`;
      });
    }
    
    if (lines.length > sampleRows + 1) {
      formatted += `\n... and ${lines.length - sampleRows - 1} more rows`;
    }
  }
  
  // Also include raw data for detailed analysis
  formatted += `\n\n**Full CSV Data:**\n${csvContent}`;
  
  return formatted;
}

/**
 * Simple CSV line parser (handles quoted values)
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"' && !inQuotes) {
      inQuotes = true;
    } else if (char === '"' && inQuotes) {
      if (line[i + 1] === '"') {
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
}

/**
 * Extract text content from PDF
 * Uses a simple approach to extract text without external dependencies
 */
async function extractPDFContent(buffer: Buffer): Promise<string> {
  try {
    // Try to dynamically import pdf-parse if available
    try {
      const pdfParse = await import('pdf-parse');
      const data = await pdfParse.default(buffer);
      return data.text || '[PDF contains no extractable text]';
    } catch {
      // pdf-parse not available, try basic extraction
      console.log('[DocExtractor] pdf-parse not available, using basic extraction');
    }
    
    // Basic PDF text extraction (limited but works for simple PDFs)
    const pdfText = buffer.toString('utf-8');
    
    // Extract text between stream markers (simplified)
    const textMatches = pdfText.match(/\(([^)]+)\)/g);
    if (textMatches && textMatches.length > 0) {
      const extractedText = textMatches
        .map(m => m.slice(1, -1)) // Remove parentheses
        .filter(t => t.length > 2 && !/^[\\x0-9A-Fa-f]+$/.test(t)) // Filter out binary/hex
        .join(' ');
      
      if (extractedText.length > 50) {
        return `[PDF text (basic extraction)]:\n${extractedText}`;
      }
    }
    
    // If basic extraction fails, provide helpful message
    return '[This PDF may contain scanned images or complex formatting. For best results, please copy the text from the PDF manually or use a PDF reader to extract the text.]';
    
  } catch (error) {
    console.error('[DocExtractor] PDF extraction error:', error);
    return '[Error reading PDF content. The file may be encrypted or corrupted.]';
  }
}

/**
 * Estimate number of pages in a PDF
 */
function estimatePDFPages(buffer: Buffer): number {
  try {
    const pdfString = buffer.toString('utf-8');
    const pageMatches = pdfString.match(/\/Type\s*\/Page[^s]/g);
    return pageMatches ? pageMatches.length : 1;
  } catch {
    return 1;
  }
}

/**
 * Try to extract text from binary documents (basic approach)
 */
async function extractBasicTextFromBinary(buffer: Buffer, filename: string): Promise<string> {
  try {
    // For DOCX files (which are ZIP archives), try to extract XML content
    if (filename.endsWith('.docx')) {
      // Basic extraction - look for text content
      const content = buffer.toString('utf-8');
      
      // Extract text between XML tags
      const textMatches = content.match(/<w:t[^>]*>([^<]+)<\/w:t>/g);
      if (textMatches && textMatches.length > 0) {
        const extractedText = textMatches
          .map(m => {
            const match = m.match(/>([^<]+)</);
            return match ? match[1] : '';
          })
          .filter((t): t is string => typeof t === 'string' && t.length > 0)
          .join(' ');
        
        if (extractedText.length > 50) {
          return `[Word document text (partial extraction)]:\n${extractedText}`;
        }
      }
    }
    
    return '';
  } catch (error) {
    console.error('[DocExtractor] Binary extraction error:', error);
    return '';
  }
}

/**
 * Extract content from multiple files
 */
export async function extractMultipleDocuments(
  files: ExtractableFile[],
  maxTotalLength: number = 100000
): Promise<DocumentExtractionResult[]> {
  const results: DocumentExtractionResult[] = [];
  let totalLength = 0;
  
  // Filter to only extractable documents (not images - those go directly to AI vision)
  const documentFiles = files.filter(f => isExtractableDocument(f.mimeType));
  
  console.log(`[DocExtractor] Processing ${documentFiles.length} document(s)`);
  
  for (const file of documentFiles) {
    // Calculate remaining space
    const remainingSpace = maxTotalLength - totalLength;
    if (remainingSpace < 1000) {
      console.log('[DocExtractor] Reached total content limit, skipping remaining files');
      break;
    }
    
    const result = await extractDocumentContent(file, remainingSpace);
    results.push(result);
    totalLength += result.content.length;
  }
  
  return results;
}

/**
 * Format extracted document content for inclusion in AI prompt
 */
export function formatDocumentsForPrompt(results: DocumentExtractionResult[]): string {
  if (results.length === 0) return '';
  
  const sections: string[] = [];
  
  for (const result of results) {
    let section = `**[Document: ${result.filename}]**\n`;
    section += `Type: ${result.mimeType}\n`;
    section += `Words: ${result.metadata.wordCount}`;
    if (result.metadata.pageCount) {
      section += ` | Pages: ${result.metadata.pageCount}`;
    }
    if (result.metadata.truncated) {
      section += ' (truncated)';
    }
    section += '\n\n';
    
    if (result.error && !result.content.startsWith('[')) {
      section += `Note: ${result.error}\n\n`;
    }
    
    section += result.content;
    sections.push(section);
  }
  
  return `\n---\n**ATTACHED DOCUMENT CONTENT:**\n${sections.join('\n---\n')}\n---\n`;
}
