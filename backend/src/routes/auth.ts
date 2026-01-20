import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "../db";
import { getUserSubscription } from "../services/subscription-service";

// ============================================
// Phone Authentication Routes
// ============================================
// WhatsApp-style phone authentication using Supabase Auth
// Supabase handles SMS sending via Twilio integration
//
// Flow:
// 1. POST /auth/send-otp { phone: "+12396998960" }
//    -> Supabase sends 6-digit code via SMS
// 2. POST /auth/verify-otp { phone: "+12396998960", code: "123456" }
//    -> Returns JWT token + creates/gets user record
// 3. Frontend stores JWT token
// 4. All API requests include token in Authorization header
// ============================================

const auth = new Hono();

// Request/Response schemas
const sendOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format (e.g., +12396998960)"),
});

const verifyOtpSchema = z.object({
  phone: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone must be in E.164 format"),
  code: z.string().length(6, "OTP code must be 6 digits"),
});

const verifyOtpResponseSchema = z.object({
  token: z.string(),
  refreshToken: z.string(),
  user: z.object({
    id: z.string(),
    phone: z.string(),
    name: z.string(),
    bio: z.string().nullable(),
    image: z.string().nullable(),
    hasCompletedOnboarding: z.boolean(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
});

// POST /auth/send-otp - Send SMS OTP code
auth.post("/send-otp", zValidator("json", sendOtpSchema), async (c) => {
  const { phone } = c.req.valid("json");

  try {
    // Supabase Auth handles sending the SMS via Twilio
    const { error } = await db.auth.signInWithOtp({
      phone,
    });

    if (error) {
      console.error("[Auth] Failed to send OTP:", error);
      return c.json({ error: "Failed to send verification code" }, 500);
    }

    return c.json({ 
      success: true,
      message: "Verification code sent via SMS" 
    });
  } catch (error) {
    console.error("[Auth] Error sending OTP:", error);
    return c.json({ error: "Failed to send verification code" }, 500);
  }
});

// POST /auth/verify-otp - Verify SMS code and create/get user
auth.post("/verify-otp", zValidator("json", verifyOtpSchema), async (c) => {
  const { phone, code } = c.req.valid("json");

  try {
    // Verify the OTP code with Supabase
    const { data: authData, error: authError } = await db.auth.verifyOtp({
      phone,
      token: code,
      type: "sms",
    });

    if (authError || !authData.user || !authData.session) {
      console.error("[Auth] OTP verification failed:", authError);
      return c.json({ error: "Invalid verification code" }, 401);
    }

    const supabaseUserId = authData.user.id;
    const accessToken = authData.session.access_token;
    const refreshToken = authData.session.refresh_token;

    // Check if user exists in our database
    const { data: existingUser } = await db
      .from("user")
      .select("*")
      .eq("id", supabaseUserId)
      .single();

    let user = existingUser;

    if (!user) {
      // Create new user in our database
      const { data: newUser, error: createError } = await db
        .from("user")
        .insert({
          id: supabaseUserId,
          phone,
          name: "Anonymous",
        })
        .select()
        .single();

      if (createError) {
        console.error("[Auth] Failed to create user:", createError);
        return c.json({ error: "Failed to create user account" }, 500);
      }

      user = newUser;

      // Automatically start 7-day Pro trial for new users
      // getUserSubscription creates a subscription with trial if none exists
      const subscription = await getUserSubscription(supabaseUserId);
      if (subscription?.isTrialActive) {
        console.log(`[Auth] Started 7-day Pro trial for new user: ${supabaseUserId}`);
      }
    }

    // Format response
    const userResponse = {
      id: user.id,
      phone: user.phone,
      name: user.name,
      bio: user.bio,
      image: user.image,
      hasCompletedOnboarding: user.hasCompletedOnboarding,
      createdAt: typeof user.createdAt === 'string' ? user.createdAt : new Date(user.createdAt).toISOString(),
      updatedAt: typeof user.updatedAt === 'string' ? user.updatedAt : new Date(user.updatedAt).toISOString(),
    };

    return c.json(verifyOtpResponseSchema.parse({
      token: accessToken,
      refreshToken: refreshToken,
      user: userResponse,
    }));
  } catch (error) {
    console.error("[Auth] Error verifying OTP:", error);
    return c.json({ error: "Verification failed" }, 500);
  }
});

// POST /auth/refresh - Refresh access token
auth.post("/refresh", async (c) => {
  const refreshToken = c.req.header("X-Refresh-Token");

  if (!refreshToken) {
    return c.json({ error: "Refresh token required" }, 401);
  }

  try {
    const { data, error } = await db.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      console.error("[Auth] Token refresh failed:", error);
      return c.json({ error: "Invalid refresh token" }, 401);
    }

    return c.json({
      token: data.session.access_token,
      refreshToken: data.session.refresh_token,
    });
  } catch (error) {
    console.error("[Auth] Error refreshing token:", error);
    return c.json({ error: "Token refresh failed" }, 500);
  }
});

// POST /auth/sign-out - Sign out user
auth.post("/sign-out", async (c) => {
  const token = c.req.header("Authorization")?.replace("Bearer ", "");

  if (!token) {
    return c.json({ error: "No token provided" }, 401);
  }

  try {
    const { error } = await db.auth.signOut(token);

    if (error) {
      console.error("[Auth] Sign out failed:", error);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("[Auth] Error signing out:", error);
    return c.json({ success: true }); // Return success anyway
  }
});

export default auth;

