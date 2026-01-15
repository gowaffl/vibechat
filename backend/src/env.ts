import { z } from "zod";
import OpenAI from "openai";
import { PostHog } from "posthog-node";

/**
 * Environment variable schema using Zod
 * This ensures all required environment variables are present and valid
 */
const envSchema = z.object({
  // Server Configuration
  PORT: z.string().optional().default("3000"),
  NODE_ENV: z.string().optional(),

  // Supabase Configuration
  SUPABASE_URL: z.string().url("SUPABASE_URL must be a valid URL"),
  SUPABASE_ANON_KEY: z.string().min(1, "SUPABASE_ANON_KEY is required"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, "SUPABASE_SERVICE_ROLE_KEY is required"),

  // Backend URL for Expo client access
  BACKEND_URL: z.string().url("BACKEND_URL must be a valid URL").default("http://localhost:3000"),

  // Google OAuth Configuration
  // GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  // GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // OpenAI Configuration
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_BASE_URL: z.string().optional(),

  // GPT-5.1 Configuration
  // Note: "none" is required for hosted tools like web_search
  GPT51_DEFAULT_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).optional().default("none"),
  GPT51_MAX_TOKENS: z.string().optional().default("4096"),

  // Data Analysis Limits
  DATA_ANALYSIS_MAX_SIZE_MB: z.string().optional().default("1"),
  DATA_ANALYSIS_MAX_ROWS: z.string().optional().default("10000"),

  // NANO-BANANA Configuration
  NANO_BANANA_API_KEY: z.string().optional(),

  // LiveKit Configuration
  LIVEKIT_API_KEY: z.string().optional().default("devkey"),
  LIVEKIT_API_SECRET: z.string().optional().default("secret"),
  LIVEKIT_URL: z.string().optional().default("ws://localhost:7880"),
  LIVEKIT_WEBHOOK_SECRET: z.string().optional(), // For verifying webhook signatures
  
  // Supabase S3 Configuration (for LiveKit Egress recordings)
  SUPABASE_S3_ENDPOINT: z.string().optional(), // e.g., https://<project-ref>.supabase.co/storage/v1/s3
  SUPABASE_S3_ACCESS_KEY: z.string().optional(),
  SUPABASE_S3_SECRET_KEY: z.string().optional(),
  SUPABASE_S3_BUCKET: z.string().optional().default("vibe-call-recordings"),

  // PostHog Configuration (for analytics and LLM observability)
  POSTHOG_API_KEY: z.string().optional(),
  POSTHOG_HOST: z.string().optional().default("https://us.i.posthog.com"),
});

/**
 * Validate and parse environment variables
 */
function validateEnv() {
  try {
    const parsed = envSchema.parse(process.env);
    console.log("✅ Environment variables validated successfully");
    return parsed;
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("❌ Environment variable validation failed:");
      error.issues.forEach((err: any) => {
        console.error(`  - ${err.path.join(".")}: ${err.message}`);
      });
      console.error("\nPlease check your .env file and ensure all required variables are set.");
      process.exit(1);
    }
    throw error;
  }
}

/**
 * Validated and typed environment variables
 */
export const env = validateEnv();

/**
 * Type of the validated environment variables
 */
export type Env = typeof env;

/**
 * Initialize OpenAI client with Vibecode proxy
 * Uses OPENAI_BASE_URL from environment if set, otherwise falls back to Vibecode proxy
 */
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "",
  baseURL: process.env.OPENAI_BASE_URL,
});

/**
 * Initialize PostHog client for backend analytics and LLM observability
 * Disabled if POSTHOG_API_KEY is not set
 */
export const posthog = env.POSTHOG_API_KEY
  ? new PostHog(env.POSTHOG_API_KEY, {
      host: env.POSTHOG_HOST,
      flushAt: 20, // Batch size before flushing
      flushInterval: 10000, // Flush every 10 seconds
    })
  : null;

// Log PostHog status
if (posthog) {
  console.log("✅ PostHog analytics enabled for backend");
} else {
  if (process.env.NODE_ENV === "development") {
    console.warn("⚠️ PostHog API key not set. Backend analytics will be disabled.");
  }
}
