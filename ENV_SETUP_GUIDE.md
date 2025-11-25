# Environment Variable Setup Guide

## Current Status

### ✅ Frontend (.env at project root)
```env
OPENAI_API_KEY=sk-proj-vdUFAIQ1t4ba0exWKCySdcqlps2Vl_9a9UxhENZJZcd9hoYwg1s8zHmaLAPDCTM5I4weO
GOOGLE_API_KEY=AIzaSyBDe3hatZYI85oVNUHQhNky14_lHN5IjcO
SUPABASE_URL=https://xxekfvxdzixysjrbxoju.supabase.co
SUPABASE_ANON_KEY=eyJh...
SUPABASE_SERVICE_ROLE_KEY=eyJh...

# Supabase Configuration  
EXPO_PUBLIC_SUPABASE_URL=https://xxekfvxdzixysjrbxoju.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJh...

# API Configuration
EXPO_PUBLIC_API_URL=https://vibechat-zdok.onrender.com
```

### ⚠️ Backend (Render Environment Variables)
Currently set on Render (from screenshot):
```env
OPENAI_API_KEY=sk-proj-vdUFAIQ1t4ba0exWKCySdcqlps2Vl_9a9UxhENZJZcd9hoYwg1s8zHmaLAPDCTM5I4weO
GOOGLE_API_KEY=AIzaSyBDe3hatZYI85oVNUHQhNky14_lHN5IjcO
SUPABASE_URL=https://xxekfvxdzixysjrbxoju.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZWtmdnh...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh4ZWtmdnh...
```

## Required Steps to Fix AI Functionality

### Step 1: Verify Render Environment Variables
1. Go to https://dashboard.render.com
2. Select your `vibechat-zdok` service
3. Navigate to **Environment** tab
4. Ensure these variables are set:
   - `OPENAI_API_KEY`
   - `GOOGLE_API_KEY` (for /image command)
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `PORT` (should be 10000 for Render)

### Step 2: Optional Backend Variables
Add these if needed:
- `NANO_BANANA_API_KEY` - For remix/meme features
- `OPENAI_BASE_URL` - If using a proxy (leave empty for default)
- `GPT51_DEFAULT_REASONING_EFFORT=none` - For GPT-5.1 features
- `GPT51_MAX_TOKENS=4096`

### Step 3: Test the Connection

After deploying with environment variables, test these endpoints:

1. **Health Check:**
   ```bash
   curl https://vibechat-zdok.onrender.com/health
   ```
   Expected: `{"status":"ok"}`

2. **Test AI Chat (from app):**
   - Open a chat
   - Type `@ai` and send a message
   - Should receive AI response

## Troubleshooting

### Issue: "AI is not responding"
- Check Render logs for OpenAI errors
- Verify `OPENAI_API_KEY` is set correctly
- Check if OpenAI API key is valid and has credits

### Issue: "Cannot connect to backend"
- Verify `EXPO_PUBLIC_API_URL` matches your Render URL
- Check Render service is running (green status)
- Test health endpoint

### Issue: "Image generation fails"
- Verify `GOOGLE_API_KEY` is set
- Check if Google API key has Gemini API enabled

## Environment Variable Validation

The backend will log on startup:
- ✅ `Environment variables validated successfully` - All required vars present
- ❌ `Environment variable validation failed` - Missing required vars

Check Render logs at: https://dashboard.render.com/web/srv-xxxxx/logs

