# Backend LLM Analytics - Quick Setup Guide

## 🚀 Getting Started (5 Minutes)

### Step 1: Get Your PostHog API Key

1. Go to your PostHog dashboard
2. Click on your project settings
3. Copy your **Project API Key** (starts with `phc_`)
4. This is for **backend tracking** (different from the frontend key)

### Step 2: Set Environment Variables

Add to your `backend/.env` file:

```bash
# PostHog Backend Analytics
POSTHOG_API_KEY_BACKEND="phc_your_backend_key_here"
POSTHOG_HOST_BACKEND="https://us.i.posthog.com"
```

**Notes**:
- If you use PostHog EU cloud, set `POSTHOG_HOST_BACKEND="https://eu.i.posthog.com"`
- If you self-host, use your custom URL
- If you don't set these, tracking will be disabled (graceful degradation)

### Step 3: Restart Backend

```bash
cd backend
bun run dev
```

### Step 4: Test It

1. Open your app
2. Send a message to trigger an AI response
3. Generate an image
4. Go to PostHog → Events
5. Look for: `llm_completion_requested`, `llm_completion_success`, `llm_completion_failed`

---

## ✅ Verification Checklist

After setup, verify these events appear in PostHog:

**AI Auto-Response (Group Chat)**:
- [ ] Send messages in a group chat
- [ ] Wait for AI to auto-respond
- [ ] Check PostHog for events with `feature: "ai_message"`, `model: "gpt-5.1"`

**@Mention AI (Group Chat)**:
- [ ] @mention an AI friend in group chat
- [ ] Check PostHog for events with `feature: "ai_message"`, `model: "gpt-5.1"`

**Image Generation (Group Chat)**:
- [ ] Use `/image` command
- [ ] Check PostHog for events with `feature: "image_generation"`, `model: "gemini-3-pro-image-preview"`

**Smart Replies (Group Chat)**:
- [ ] Let app generate smart replies
- [ ] Check PostHog for events with `feature: "smart_reply"`, `model: "gpt-5-mini"`

**Personal Chat**:
- [ ] Send a message to a personal AI friend
- [ ] Check PostHog for events with `feature: "ai_message"`, `model: "gemini-3-flash-preview"`

---

## 📊 What You'll See in PostHog

### Event Properties (Example)

```json
{
  "event": "llm_completion_success",
  "properties": {
    "model": "gpt-5.1",
    "provider": "openai",
    "feature": "ai_message",
    "user_id": "user_123",
    "chat_id": "chat_456",
    "prompt_tokens": 250,
    "completion_tokens": 150,
    "total_tokens": 400,
    "latency_ms": 1234,
    "cost_usd": 0.00025,
    "finish_reason": "stop"
  }
}
```

---

## 🎯 Quick Wins

### 1. Track Total AI Cost

**PostHog Insight**:
- Event: `llm_completion_success`
- Metric: Sum of `cost_usd`
- Filters: None (or by feature, model, user)

### 2. Monitor Error Rate

**PostHog Funnel**:
- Step 1: `llm_completion_requested`
- Step 2: `llm_completion_success`
- This shows % of requests that succeed

### 3. Find Slow Features

**PostHog Insight**:
- Event: `llm_completion_success`
- Metric: Average `latency_ms`
- Breakdown: By `feature`

---

## 🔧 Troubleshooting

### Events Not Appearing?

1. **Check environment variable is set**:
   ```bash
   echo $POSTHOG_API_KEY_BACKEND
   ```

2. **Check backend logs**:
   - Look for PostHog initialization messages
   - No errors should appear

3. **Verify PostHog project key**:
   - Make sure you're using the correct project
   - Key should start with `phc_`

4. **Test with curl**:
   ```bash
   curl -X POST https://us.i.posthog.com/capture/ \
     -H "Content-Type: application/json" \
     -d '{
       "api_key": "YOUR_KEY_HERE",
       "event": "test_event",
       "distinct_id": "test_user"
     }'
   ```

### Events Missing Properties?

- Check that the feature was properly instrumented
- Review `backend/src/services/llm-analytics.ts` for the event schema
- Ensure you're passing all required properties

### Cost Not Calculating?

- Update model pricing in the tracking calls
- Current pricing is placeholder estimates
- Get actual pricing from OpenAI/Google

---

## 📈 Recommended PostHog Dashboard

Create a dashboard with these insights:

### Row 1: Cost Overview
1. **Total AI Cost (This Month)** - Single number, sum of `cost_usd`
2. **Daily AI Cost** - Line chart, sum of `cost_usd` by day
3. **Cost by Feature** - Bar chart, sum of `cost_usd` by `feature`

### Row 2: Usage
4. **Total AI Requests** - Single number, count of `llm_completion_success`
5. **Requests by Feature** - Bar chart, count by `feature`
6. **Token Usage by Model** - Bar chart, sum of `total_tokens` by `model`

### Row 3: Performance
7. **Average Latency** - Single number, avg of `latency_ms`
8. **Latency by Feature** - Line chart, avg `latency_ms` over time, breakdown by `feature`
9. **P95 Latency** - Single number, 95th percentile of `latency_ms`

### Row 4: Reliability
10. **Success Rate** - Funnel: requested → success
11. **Error Rate by Feature** - Bar chart, count of `llm_completion_failed` by `feature`
12. **Top Errors** - Table: `error_type`, `feature`, count

---

## 🎁 Bonus: Slack Alerts (Optional)

Set up Slack alerts for critical issues:

### High Error Rate Alert

**PostHog Alert**:
- Metric: Count of `llm_completion_failed`
- Threshold: More than 10 in last hour
- Action: Send to Slack channel

### Cost Spike Alert

**PostHog Alert**:
- Metric: Sum of `cost_usd`
- Threshold: More than $X per hour
- Action: Send to Slack channel

### Slow Response Alert

**PostHog Alert**:
- Metric: Average `latency_ms`
- Threshold: More than 10000ms (10 seconds)
- Action: Send to Slack channel

---

## 🚦 Status Indicators

Use these queries to monitor health:

### Green (Healthy)
- ✅ Error rate < 2%
- ✅ Average latency < 3 seconds
- ✅ No cost spikes
- ✅ All features responding

### Yellow (Warning)
- ⚠️ Error rate 2-5%
- ⚠️ Average latency 3-7 seconds
- ⚠️ Cost trending up
- ⚠️ Some features slow

### Red (Critical)
- 🚨 Error rate > 5%
- 🚨 Average latency > 10 seconds
- 🚨 Cost spike (2x+ normal)
- 🚨 Features failing

---

## 📚 Additional Resources

- **Full Implementation Guide**: `BACKEND_LLM_ANALYTICS_COMPLETE.md`
- **Summary**: `LLM_ANALYTICS_IMPLEMENTATION_SUMMARY.md`
- **PostHog Docs**: https://posthog.com/docs/ai-engineering/llm-observability
- **PostHog Node SDK**: https://posthog.com/docs/libraries/node

---

## ✨ You're All Set!

Your backend is now tracking all AI/LLM usage. You can:
- Monitor costs in real-time
- Debug issues faster
- Optimize performance
- Make data-driven decisions

**Happy tracking! 🎉**
