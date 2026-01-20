# RevenueCat Backend Setup on Render

This guide explains how to configure RevenueCat API keys in your Render backend for secure subscription management.

---

## 🔑 Environment Variables to Add

### Required for Production

Add these environment variables to your Render service:

1. **`REVENUECAT_SECRET_KEY`** (Optional but Recommended)
   - **Purpose**: For server-side API calls to RevenueCat
   - **Value**: Your V2 Secret API Key from RevenueCat (starts with `sk_`)
   - **Use cases**:
     - Verify subscription status server-side
     - Get customer information
     - Grant/revoke entitlements programmatically

2. **`REVENUECAT_WEBHOOK_TOKEN`** (Highly Recommended)
   - **Purpose**: Secure your webhook endpoint
   - **Value**: A random secure token (generate one or use RevenueCat's)
   - **Example**: `webhook_secret_abc123xyz789`

---

## 📝 Step-by-Step Setup

### 1. Get Your RevenueCat Secret API Key

1. Go to [RevenueCat Dashboard](https://app.revenuecat.com/)
2. Select your project
3. Navigate to **Settings** → **API Keys**
4. Copy the **V2 Secret Key** (starts with `sk_`)
   - ⚠️ **Never commit this to your repository!**
   - Store it securely in Render's environment variables

### 2. Generate a Webhook Token

You can use any secure random string. Here are a few ways to generate one:

**Option A: Use OpenSSL (Mac/Linux)**
```bash
openssl rand -hex 32
```

**Option B: Use Node.js**
```javascript
require('crypto').randomBytes(32).toString('hex')
```

**Option C: Use a password generator**
- Use a tool like 1Password or LastPass to generate a 32+ character random string

### 3. Add Environment Variables to Render

1. Log in to [Render Dashboard](https://dashboard.render.com/)
2. Select your backend service
3. Go to **Environment** tab
4. Click **Add Environment Variable**
5. Add both variables:

   ```
   Name: REVENUECAT_SECRET_KEY
   Value: sk_your_actual_secret_key_here
   ```

   ```
   Name: REVENUECAT_WEBHOOK_TOKEN
   Value: your_secure_webhook_token_here
   ```

6. Click **Save Changes**
7. Render will automatically redeploy your service

### 4. Configure Webhook in RevenueCat

1. Go to RevenueCat Dashboard
2. Navigate to **Integrations** → **Webhooks**
3. Click **+ New** to add a webhook
4. Configure:
   - **URL**: `https://your-render-backend.onrender.com/api/subscriptions/webhook`
   - **Authorization Header**: `Bearer your_secure_webhook_token_here`
   - **Events**: Select all subscription events:
     - `INITIAL_PURCHASE`
     - `RENEWAL`
     - `CANCELLATION`
     - `EXPIRATION`
     - `PRODUCT_CHANGE`
     - `BILLING_ISSUE`
5. Click **Add Webhook**

### 5. Test Your Webhook

1. In RevenueCat Dashboard, find your webhook
2. Click **Send Test Event**
3. Choose event type: `INITIAL_PURCHASE`
4. Check your Render logs to verify:
   - ✅ Webhook received successfully
   - ✅ Authorization verified
   - ✅ Event processed

---

## 🔒 Security Features Implemented

### Webhook Verification

Your backend now **verifies** that webhook requests are actually from RevenueCat:

```typescript
// In /api/subscriptions/webhook
if (env.REVENUECAT_WEBHOOK_TOKEN) {
  const authHeader = c.req.header("Authorization");
  const expectedAuth = `Bearer ${env.REVENUECAT_WEBHOOK_TOKEN}`;
  
  if (!authHeader || authHeader !== expectedAuth) {
    return c.json({ error: "Unauthorized" }, 401);
  }
}
```

**What this prevents:**
- ❌ Fake webhook requests from malicious actors
- ❌ Unauthorized subscription changes
- ❌ Subscription fraud

### Without This Security

If you don't set `REVENUECAT_WEBHOOK_TOKEN`:
- ⚠️ Anyone can send fake webhooks to your endpoint
- ⚠️ They could grant themselves Pro subscriptions
- ⚠️ They could bypass payment
- ⚠️ **This is a serious security vulnerability!**

---

## 🚨 Important Notes

### Development vs Production

**For Development/Testing:**
- You can skip setting these variables for local development
- The app will work but webhook security will be disabled
- You'll see a warning in logs: `⚠️ REVENUECAT_WEBHOOK_TOKEN not set`

**For Production:**
- ✅ **MUST** set `REVENUECAT_WEBHOOK_TOKEN`
- ✅ Recommended to set `REVENUECAT_SECRET_KEY`
- ✅ Configure webhook in RevenueCat with authorization

### Public vs Secret Keys

**Public SDK Key** (in frontend):
- Already configured: `test_yRYvtLzmxZeukKZSqwKPYpSXpTE`
- Safe to include in frontend code
- Used by RevenueCat SDK in the app
- Can be committed to repository

**Secret API Key** (in backend):
- Starts with `sk_`
- **NEVER** commit to repository
- **NEVER** expose in frontend code
- Only store in Render environment variables
- Used for server-side API calls

---

## 🧪 Testing Your Setup

### 1. Verify Environment Variables

SSH into your Render service or check environment variables:

```bash
# In Render shell
echo $REVENUECAT_SECRET_KEY  # Should output: sk_...
echo $REVENUECAT_WEBHOOK_TOKEN  # Should output: your_token
```

### 2. Test Webhook Endpoint

**Valid Request (should succeed):**
```bash
curl -X POST https://your-render-backend.onrender.com/api/subscriptions/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer your_webhook_token_here" \
  -d '{
    "event": {
      "type": "TEST",
      "app_user_id": "test_user_123",
      "product_id": "monthly_pro",
      "entitlement_ids": ["pro"]
    }
  }'
```

**Invalid Request (should be rejected with 401):**
```bash
curl -X POST https://your-render-backend.onrender.com/api/subscriptions/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer wrong_token" \
  -d '{
    "event": {
      "type": "TEST",
      "app_user_id": "test_user_123"
    }
  }'
```

### 3. Monitor Logs

In Render Dashboard:
1. Go to your service
2. Click **Logs** tab
3. Look for:
   - `✅ Environment variables validated successfully`
   - `[Subscriptions] Processing RevenueCat webhook:`
   - `[Subscriptions] Webhook processed: ...`

---

## 📚 What Each Variable Does

### REVENUECAT_SECRET_KEY

**When you need it:**
- Server-side subscription verification
- Programmatic entitlement management
- Accessing RevenueCat REST API

**Current usage in your backend:**
- None yet, but available for future use
- Example use cases:
  - Manual subscription verification on user login
  - Granting promotional subscriptions
  - Syncing subscriptions from external systems

**RevenueCat API endpoints you can call with this:**
- `GET /subscribers/{app_user_id}` - Get customer info
- `POST /subscribers/{app_user_id}/entitlements` - Grant entitlements
- `DELETE /subscribers/{app_user_id}/entitlements` - Revoke entitlements
- And more...

### REVENUECAT_WEBHOOK_TOKEN

**When you need it:**
- ✅ **Always in production!**
- Secures your webhook endpoint
- Prevents unauthorized subscription changes

**Current usage in your backend:**
- Webhook verification in `/api/subscriptions/webhook`
- Rejects requests without valid authorization header

---

## 🔄 Webhook Flow (Secured)

```
1. User purchases subscription in app
   ↓
2. App Store/Play Store processes payment
   ↓
3. RevenueCat receives transaction
   ↓
4. RevenueCat sends webhook to your backend
   Headers:
   - Authorization: Bearer your_webhook_token_here
   - Content-Type: application/json
   Body:
   - { event: { type: "INITIAL_PURCHASE", ... } }
   ↓
5. Your backend verifies Authorization header
   ✅ Match → Process webhook
   ❌ No match → Reject with 401
   ↓
6. Update user subscription in database
   ↓
7. User gets immediate access to Pro features
```

---

## 🛡️ Security Best Practices

1. **Never commit secrets to Git**
   - Use Render environment variables
   - Add `.env` files to `.gitignore`
   - Use different keys for dev/staging/prod

2. **Rotate webhook tokens periodically**
   - Every 6-12 months
   - After any security incident
   - When team members leave

3. **Use different keys per environment**
   - Development: `webhook_dev_...`
   - Staging: `webhook_staging_...`
   - Production: `webhook_prod_...`

4. **Monitor webhook requests**
   - Log all webhook attempts
   - Alert on repeated 401 errors
   - Track subscription changes

5. **Validate all webhook data**
   - Already implemented with Zod schemas
   - Never trust webhook data blindly
   - Verify user IDs exist in your database

---

## 🎯 Quick Checklist

Before deploying to production:

- [ ] Added `REVENUECAT_SECRET_KEY` to Render environment
- [ ] Added `REVENUECAT_WEBHOOK_TOKEN` to Render environment
- [ ] Configured webhook in RevenueCat dashboard
- [ ] Set Authorization header in RevenueCat webhook
- [ ] Tested webhook with "Send Test Event"
- [ ] Verified webhook authorization works (check logs)
- [ ] Verified unauthorized requests are rejected
- [ ] Documented webhook token in secure location (1Password, etc.)

---

## 🆘 Troubleshooting

### "Webhook not received"
- Check webhook URL is correct (HTTPS, correct domain)
- Verify service is running on Render
- Check Render logs for errors
- Test with curl command (see Testing section)

### "Webhook returns 401 Unauthorized"
- Verify `REVENUECAT_WEBHOOK_TOKEN` is set in Render
- Check Authorization header in RevenueCat matches exactly
- Must include "Bearer " prefix: `Bearer your_token_here`
- No extra spaces or line breaks

### "Environment variable not found"
- Redeploy service after adding environment variables
- Check spelling of variable name
- Ensure variable is set in correct environment (dev/prod)

### "Subscription not updating in app"
- Check webhook processed successfully in logs
- Verify database was updated (check Supabase)
- Try force-refreshing subscription status in app
- Use "Restore Purchases" button

---

## 📖 Additional Resources

- [RevenueCat Webhooks Guide](https://www.revenuecat.com/docs/webhooks)
- [RevenueCat REST API](https://www.revenuecat.com/docs/api-v1)
- [Render Environment Variables](https://render.com/docs/environment-variables)
- [Webhook Security Best Practices](https://webhooks.fyi/security/best-practices)

---

## Summary

✅ **Added** webhook authorization verification to backend
✅ **Added** environment variable schema for RevenueCat keys
✅ **Secured** `/api/subscriptions/webhook` endpoint
✅ **Documented** complete setup process

Now your backend is ready for secure production subscription management! 🎉
