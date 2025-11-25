/**
 * Data Analysis Tool Service
 * 
 * Provides data analysis capabilities for the GPT-5.1 agent including:
 * - CSV/JSON parsing and validation
 * - Statistical analysis
 * - Data transformation and filtering
 * - Insight generation
 */

export interface DataAnalysisRequest {
  data: string; // Raw data as string (CSV or JSON)
  format: "csv" | "json" | "auto";
  operation:
    | "describe"
    | "calculate"
    | "filter"
    | "transform"
    | "summarize"
    | "auto";
  options?: {
    columns?: string[]; // Specific columns to analyze
    filters?: Record<string, any>; // Filter criteria
    calculations?: string[]; // Specific calculations to perform
  };
}

export interface DataAnalysisResult {
  success: boolean;
  summary: string;
  details?: {
    rowCount?: number;
    columnCount?: number;
    columns?: string[];
    statistics?: Record<string, any>;
    filtered?: any[];
    calculated?: Record<string, number>;
  };
  error?: string;
}

/**
 * Maximum data size to prevent abuse (1MB)
 */
const MAX_DATA_SIZE = 1024 * 1024;

/**
 * Maximum number of rows to process
 */
const MAX_ROWS = 10000;

/**
 * Analyze data based on the request parameters
 */
export async function analyzeData(
  request: DataAnalysisRequest
): Promise<DataAnalysisResult> {
  try {
    // Validate data size
    if (request.data.length > MAX_DATA_SIZE) {
      return {
        success: false,
        summary: "Data too large",
        error: `Data size exceeds maximum allowed size of ${MAX_DATA_SIZE / 1024}KB`,
      };
    }

    // Auto-detect format if needed
    const format = request.format === "auto" ? detectFormat(request.data) : request.format;

    if (!format) {
      return {
        success: false,
        summary: "Unable to detect data format",
        error: "Could not determine if data is CSV or JSON. Please specify format explicitly.",
      };
    }

    // Parse data
    const parsedData = format === "json" 
      ? parseJSON(request.data) 
      : parseCSV(request.data);

    if (!parsedData || parsedData.length === 0) {
      return {
        success: false,
        summary: "No data found",
        error: "Data is empty or could not be parsed",
      };
    }

    // Validate row count
    if (parsedData.length > MAX_ROWS) {
      return {
        success: false,
        summary: "Too many rows",
        error: `Data contains ${parsedData.length} rows, maximum allowed is ${MAX_ROWS}`,
      };
    }

    // Auto-detect operation if needed
    const operation = request.operation === "auto" ? "describe" : request.operation;

    // Execute the requested operation
    switch (operation) {
      case "describe":
        return describeData(parsedData, request.options);
      case "calculate":
        return calculateData(parsedData, request.options);
      case "filter":
        return filterData(parsedData, request.options);
      case "transform":
        return transformData(parsedData, request.options);
      case "summarize":
        return summarizeData(parsedData, request.options);
      default:
        return {
          success: false,
          summary: "Unknown operation",
          error: `Operation '${operation}' is not supported`,
        };
    }
  } catch (error: any) {
    console.error("[DataAnalysis] Error:", error);
    return {
      success: false,
      summary: "Data analysis failed",
      error: error?.message || "Unknown error occurred",
    };
  }
}

/**
 * Detect data format (CSV or JSON)
 */
function detectFormat(data: string): "csv" | "json" | null {
  const trimmed = data.trim();

  // Check for JSON
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // Check for CSV (look for common patterns)
  if (trimmed.includes(",") || trimmed.includes("\n")) {
    return "csv";
  }

  return null;
}

/**
 * Parse JSON data into array of objects
 */
function parseJSON(data: string): any[] {
  try {
    const parsed = JSON.parse(data);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch (error) {
    throw new Error("Invalid JSON format");
  }
}

/**
 * Parse CSV data into array of objects
 */
function parseCSV(data: string): any[] {
  try {
    const lines = data.trim().split("\n");
    if (lines.length < 2) {
      throw new Error("CSV must have at least a header row and one data row");
    }

    // Parse header
    const headers = lines[0].split(",").map((h) => h.trim());

    // Parse data rows
    const rows = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(",").map((v) => v.trim());
      const row: any = {};

      headers.forEach((header, index) => {
        const value = values[index];
        // Try to convert to number if possible
        row[header] = isNaN(Number(value)) ? value : Number(value);
      });

      rows.push(row);
    }

    return rows;
  } catch (error: any) {
    throw new Error(`CSV parsing failed: ${error?.message}`);
  }
}

/**
 * Describe data (summary statistics)
 */
function describeData(
  data: any[],
  options?: DataAnalysisRequest["options"]
): DataAnalysisResult {
  const columns = options?.columns || Object.keys(data[0] || {});
  const statistics: Record<string, any> = {};

  columns.forEach((column) => {
    const values = data.map((row) => row[column]).filter((v) => v != null);
    const numericValues = values.filter((v) => typeof v === "number" || !isNaN(Number(v))).map(Number);

    if (numericValues.length > 0) {
      statistics[column] = {
        count: values.length,
        mean: calculateMean(numericValues),
        median: calculateMedian(numericValues),
        min: Math.min(...numericValues),
        max: Math.max(...numericValues),
        sum: numericValues.reduce((a, b) => a + b, 0),
      };
    } else {
      // Categorical data
      const uniqueValues = [...new Set(values)];
      statistics[column] = {
        count: values.length,
        unique: uniqueValues.length,
        top: findMode(values),
      };
    }
  });

  const summary = `Analyzed ${data.length} rows with ${columns.length} columns. ${
    Object.keys(statistics).length
  } columns contain data.`;

  return {
    success: true,
    summary,
    details: {
      rowCount: data.length,
      columnCount: columns.length,
      columns,
      statistics,
    },
  };
}

/**
 * Calculate specific metrics on data
 */
function calculateData(
  data: any[],
  options?: DataAnalysisRequest["options"]
): DataAnalysisResult {
  const calculations = options?.calculations || ["sum", "mean", "count"];
  const columns = options?.columns || Object.keys(data[0] || {});
  const calculated: Record<string, number> = {};

  columns.forEach((column) => {
    const values = data.map((row) => row[column]).filter((v) => v != null);
    const numericValues = values.filter((v) => typeof v === "number" || !isNaN(Number(v))).map(Number);

    if (numericValues.length > 0) {
      calculations.forEach((calc) => {
        const key = `${column}_${calc}`;
        switch (calc.toLowerCase()) {
          case "sum":
            calculated[key] = numericValues.reduce((a, b) => a + b, 0);
            break;
          case "mean":
          case "average":
            calculated[key] = calculateMean(numericValues);
            break;
          case "median":
            calculated[key] = calculateMedian(numericValues);
            break;
          case "min":
            calculated[key] = Math.min(...numericValues);
            break;
          case "max":
            calculated[key] = Math.max(...numericValues);
            break;
          case "count":
            calculated[key] = numericValues.length;
            break;
        }
      });
    }
  });

  const summary = `Calculated ${Object.keys(calculated).length} metrics across ${columns.length} columns.`;

  return {
    success: true,
    summary,
    details: {
      calculated,
      rowCount: data.length,
    },
  };
}

/**
 * Filter data based on criteria
 */
function filterData(
  data: any[],
  options?: DataAnalysisRequest["options"]
): DataAnalysisResult {
  if (!options?.filters || Object.keys(options.filters).length === 0) {
    return {
      success: false,
      summary: "No filter criteria provided",
      error: "Please specify filters in options",
    };
  }

  const filtered = data.filter((row) => {
    return Object.entries(options.filters!).every(([key, value]) => {
      return row[key] === value;
    });
  });

  const summary = `Filtered ${data.length} rows down to ${filtered.length} rows matching criteria.`;

  return {
    success: true,
    summary,
    details: {
      rowCount: data.length,
      filtered: filtered.slice(0, 100), // Limit to first 100 for output
    },
  };
}

/**
 * Transform data (placeholder for future enhancements)
 */
function transformData(
  data: any[],
  options?: DataAnalysisRequest["options"]
): DataAnalysisResult {
  // Basic transformation: select specific columns
  const columns = options?.columns || Object.keys(data[0] || {});
  const transformed = data.map((row) => {
    const newRow: any = {};
    columns.forEach((col) => {
      newRow[col] = row[col];
    });
    return newRow;
  });

  const summary = `Transformed ${data.length} rows, keeping ${columns.length} columns.`;

  return {
    success: true,
    summary,
    details: {
      rowCount: transformed.length,
      columns,
    },
  };
}

/**
 * Summarize data (high-level overview)
 */
function summarizeData(
  data: any[],
  options?: DataAnalysisRequest["options"]
): DataAnalysisResult {
  const columns = Object.keys(data[0] || {});
  const numericColumns = columns.filter((col) => {
    const values = data.map((row) => row[col]);
    return values.some((v) => typeof v === "number" || !isNaN(Number(v)));
  });

  const categoricalColumns = columns.filter(
    (col) => !numericColumns.includes(col)
  );

  const summary = `Dataset contains ${data.length} rows and ${columns.length} columns (${numericColumns.length} numeric, ${categoricalColumns.length} categorical).`;

  return {
    success: true,
    summary,
    details: {
      rowCount: data.length,
      columnCount: columns.length,
      columns,
    },
  };
}

/**
 * Calculate mean of numeric array
 */
function calculateMean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate median of numeric array
 */
function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

/**
 * Find mode (most common value) in array
 */
function findMode(values: any[]): any {
  const frequency: Record<string, number> = {};

  values.forEach((value) => {
    const key = String(value);
    frequency[key] = (frequency[key] || 0) + 1;
  });

  let maxFreq = 0;
  let mode: any = null;

  Object.entries(frequency).forEach(([value, freq]) => {
    if (freq > maxFreq) {
      maxFreq = freq;
      mode = value;
    }
  });

  return mode;
}

