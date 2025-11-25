/**
 * API Client Module
 *
 * This module provides a centralized API client for making HTTP requests to the backend.
 * It handles authentication, request formatting, error handling, and response parsing.
 */

// Import fetch from expo/fetch for React Native compatibility
// This ensures fetch works correctly across different platforms (iOS, Android, Web)
import { fetch } from "expo/fetch";

// Import the authentication client to access user session cookies
import { authClient } from "./authClient";

/**
 * Backend URL Configuration
 *
 * The backend URL should be set in your .env file as EXPO_PUBLIC_API_URL.
 * If not set, it falls back to localhost for development.
 * 
 * Note: For physical devices, you must use your computer's local IP address
 * (e.g., http://192.168.1.x:3000) instead of localhost.
 */
const BACKEND_URL = process.env.EXPO_PUBLIC_API_URL || process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL || "http://localhost:3000";

if (!process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_VIBECODE_BACKEND_URL) {
  console.warn("⚠️ Backend URL not set in env. using default:", BACKEND_URL);
}

type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

type FetchOptions = {
  method: HttpMethod;
  body?: object; // Request body, will be JSON stringified before sending
};

/**
 * Core Fetch Function
 *
 * A generic, type-safe wrapper around the fetch API that handles all HTTP requests.
 *
 * @template T - The expected response type (for type safety)
 * @param path - The API endpoint path (e.g., "/api/posts")
 * @param options - Configuration object containing HTTP method and optional body
 * @returns Promise resolving to the typed response data
 *
 * Features:
 * - Automatic authentication: Attaches session cookies from authClient
 * - JSON handling: Automatically stringifies request bodies and parses responses
 * - Error handling: Throws descriptive errors with status codes and messages
 * - Type safety: Returns strongly-typed responses using TypeScript generics
 *
 * @throws Error if the response is not ok (status code outside 200-299 range)
 */
const fetchFn = async <T>(path: string, options: FetchOptions): Promise<T> => {
  const { method, body } = options;
  // Step 1: Authentication - Get JWT token from Supabase auth
  const token = await authClient.getToken();
  
  // Step 2: Build headers
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  // Step 3: Make the HTTP request
  try {
    // Construct the full URL by combining the base backend URL with the endpoint path
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method,
      headers,
      // Stringify the body if present (for POST, PUT, PATCH requests)
      body: body ? JSON.stringify(body) : undefined,
      // Use "omit" to prevent browser from automatically sending credentials
      credentials: "omit",
    });

    // Step 3: Error handling - Check if the response was successful
    if (!response.ok) {
      // Check content type to determine if response is JSON
      const contentType = response.headers.get("content-type");
      let errorData: any;

      if (contentType && contentType.includes("application/json")) {
        // Parse JSON error response
        errorData = await response.json();
      } else {
        // Non-JSON response (likely HTML error page)
        const textResponse = await response.text();
        errorData = { error: "Non-JSON response received", details: textResponse.substring(0, 200) };
      }

      // Throw a descriptive error with status code, status text, and server error data
      throw new Error(
        `[api.ts]: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`,
      );
    }

    // Step 4: Parse and return the successful response as JSON
    // The response is cast to the expected type T for type safety
    const jsonResponse = await response.json();
    console.log(`[API Success] ${method} ${path}:`, jsonResponse);
    return jsonResponse as T;
  } catch (error: any) {
    // Log the error for debugging purposes
    console.log(`[API Error] ${method} ${path}:`, error);
    console.log(`[API Error] Full details:`, JSON.stringify(error, null, 2));
    // Re-throw the error so the calling code can handle it appropriately
    throw error;
  }
};

/**
 * API Client Object
 *
 * Provides convenient methods for making HTTP requests with different methods.
 * Each method is a thin wrapper around fetchFn with the appropriate HTTP verb.
 *
 * Usage Examples:
 *
 * // GET request - Fetch data
 * const posts = await api.get<Post[]>('/api/posts');
 *
 * // POST request - Create new data
 * const newPost = await api.post<Post>('/api/posts', {
 *   title: 'My Post',
 *   content: 'Hello World'
 * });
 *
 * // PUT request - Replace existing data
 * const updatedPost = await api.put<Post>('/api/posts/123', {
 *   title: 'Updated Title',
 *   content: 'Updated Content'
 * });
 *
 * // PATCH request - Partially update existing data
 * const patchedPost = await api.patch<Post>('/api/posts/123', {
 *   title: 'New Title Only'
 * });
 *
 * // DELETE request - Remove data
 * await api.delete('/api/posts/123');
 *
 * // POST FormData - Upload files
 * const formData = new FormData();
 * formData.append('image', file);
 * const result = await api.postFormData<UploadResponse>('/api/upload', formData);
 */
const api = {
  /**
   * GET - Retrieve data from the server
   * @template T - Expected response type
   * @param path - API endpoint path
   */
  get: <T>(path: string) => fetchFn<T>(path, { method: "GET" }),

  /**
   * POST - Create new data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing data to create
   */
  post: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "POST", body }),

  /**
   * PUT - Replace existing data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing data to replace
   */
  put: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "PUT", body }),

  /**
   * PATCH - Partially update existing data on the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body containing partial data to update
   */
  patch: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "PATCH", body }),

  /**
   * DELETE - Remove data from the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param body - Optional request body for DELETE requests that need data
   */
  delete: <T>(path: string, body?: object) => fetchFn<T>(path, { method: "DELETE", body }),

  /**
   * POST FormData - Upload files to the server
   * @template T - Expected response type
   * @param path - API endpoint path
   * @param formData - FormData object containing files or other data
   */
  postFormData: async <T>(path: string, formData: FormData): Promise<T> => {
    const cookies = authClient.getCookie();

    try {
      const headers: HeadersInit = {};

      if (cookies) {
        headers.Cookie = cookies;
      }

      // Don't set Content-Type header - let fetch set it automatically with boundary
      const response = await fetch(`${BACKEND_URL}${path}`, {
        method: "POST",
        headers,
        body: formData,
        credentials: "omit",
      });

      if (!response.ok) {
        // Check content type to determine if response is JSON
        const contentType = response.headers.get("content-type");
        let errorData: any;

        if (contentType && contentType.includes("application/json")) {
          // Parse JSON error response
          errorData = await response.json();
        } else {
          // Non-JSON response (likely HTML error page)
          const textResponse = await response.text();
          errorData = { error: "Non-JSON response received", details: textResponse.substring(0, 200) };
        }

        throw new Error(
          `[api.ts]: ${response.status} ${response.statusText} ${JSON.stringify(errorData)}`,
        );
      }

      return response.json() as Promise<T>;
    } catch (error: any) {
      console.log(`[API Error]: ${error}`);
      throw error;
    }
  },
};

// Export the API client and backend URL to be used in other modules
export { api, BACKEND_URL };
