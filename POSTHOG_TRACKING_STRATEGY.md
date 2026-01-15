# PostHog Tracking Strategy for VibeChat

## 📊 North Star Metric

**Messages Sent Per Week (Per Active User)**

Why this metric?
- Direct indicator of engagement and product value
- Correlates with retention and user satisfaction
- Easy to measure and understand
- Drives all other growth metrics

### Supporting Metrics
1. **Daily Active Users (DAU)** - Users who send ≥1 message
2. **Weekly Active Users (WAU)** - Users who send ≥1 message per week
3. **Retention Rate** - % of users who return after Day 1, 7, 30
4. **Time to First Message** - How quickly new users engage

---

## 🎯 Critical User Journeys to Track

### 1. **Activation Journey** (New User → Active User)
```
Sign Up → Complete Onboarding → Create/Join First Chat → Send First Message
```

**Events to Track:**
- `user_signed_up` - User creates account
- `onboarding_step_completed` - Each onboarding step
- `onboarding_completed` - User finishes onboarding
- `first_chat_joined` - User joins or creates first chat
- `first_message_sent` - User sends their first message ⭐ **KEY ACTIVATION EVENT**

**Success Metric:** % of signups who send first message within 24 hours

### 2. **Engagement Journey** (Active User → Power User)
```
Send Messages → Use AI Features → Invite Friends → Create Multiple Chats
```

**Events to Track:**
- `message_sent` (type, has_media, has_vibe, has_ai)
- `reaction_added` (emoji)
- `ai_feature_used` (feature_type: catchup, tldr, translate, image_gen)
- `voice_call_started` / `voice_call_ended`
- `invite_sent` / `invite_accepted`
- `chat_created` (type: group, personal)

**Success Metric:** % of users who use ≥3 different features per week

### 3. **Retention Journey** (Power User → Retained User)
```
Daily Active Use → Weekly Active Use → Monthly Active Use
```

**Events to Track:**
- `app_opened` (session_start)
- `chat_viewed` (chat_id)
- `notification_received` / `notification_opened`
- `catch_up_used` (return after absence)
- `bookmark_added` (content saved)

**Success Metric:** Day 7 retention rate > 40%

### 4. **Monetization Journey** (User → Premium User)
```
View Premium Feature → See Paywall → Subscribe → Use Premium
```

**Events to Track:**
- `premium_feature_attempted` (feature_name, locked: true/false)
- `paywall_viewed` (trigger_feature)
- `premium_cta_clicked` (source: paywall/settings/feature)
- `premium_subscribed` (plan, price)
- `premium_feature_used` (feature_name)

**Success Metric:** Conversion rate to premium > 2%

---

## 📋 Complete Event Taxonomy

### User Lifecycle Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `user_signed_up` | `method`, `referrer` | After phone verification |
| `user_signed_in` | `method` | On successful login |
| `user_signed_out` | - | On logout |
| `onboarding_step_completed` | `step_name`, `step_number` | After each onboarding screen |
| `onboarding_completed` | `time_taken_seconds` | When user finishes onboarding |
| `profile_updated` | `field_updated` | When user updates profile |

### Messaging Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `message_sent` | `type`, `has_media`, `has_vibe`, `has_mention`, `chat_type`, `char_length` | When message is sent |
| `message_received` | `sender_type` | When message arrives |
| `reaction_added` | `emoji`, `message_type` | When user reacts to message |
| `reaction_removed` | `emoji` | When user removes reaction |
| `message_replied` | `reply_type` | When user replies to message |
| `message_deleted` | `own_message` | When message deleted |
| `message_copied` | `message_type` | When message copied |
| `message_shared` | `share_type` | When message shared |
| `message_bookmarked` | - | When message bookmarked |

### AI Feature Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `catch_up_viewed` | `unread_count`, `summary_type` | When catch-up modal opened |
| `catch_up_generated` | `message_count`, `time_taken_ms` | When summary generated |
| `ai_message_sent` | `command`, `has_tools`, `persona_name` | When AI assistant used |
| `tldr_generated` | `message_count` | When TLDR summary created |
| `translation_used` | `from_lang`, `to_lang`, `auto_detected` | When message translated |
| `image_generated` | `prompt_length`, `success`, `time_taken_ms` | When AI image created |
| `smart_reply_used` | `reply_text_length` | When AI suggestion selected |

### Voice & Video Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `voice_call_started` | `participant_count`, `call_type` | When voice call begins |
| `voice_call_joined` | `join_time_seconds` | When user joins call |
| `voice_call_left` | `duration_seconds` | When user leaves call |
| `voice_call_ended` | `duration_seconds`, `participant_count` | When call ends |
| `voice_message_sent` | `duration_seconds` | When voice msg sent |
| `voice_message_played` | - | When voice msg played |

### Social & Discovery Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `chat_created` | `type`, `initial_member_count` | When chat created |
| `chat_joined` | `join_method`, `member_count` | When user joins chat |
| `chat_left` | `member_count` | When user leaves chat |
| `invite_sent` | `method`, `recipient_count` | When invite created |
| `invite_accepted` | `chat_id` | When invite used |
| `friend_added` | - | When contact added |
| `thread_created` | `rule_count`, `is_shared` | When thread filter created |
| `thread_viewed` | `thread_name`, `message_count` | When thread opened |

### Content Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `event_created` | `has_date`, `has_location` | When event planned |
| `event_rsvp` | `response_type` | When user RSVPs |
| `poll_created` | `option_count`, `allow_multiple` | When poll created |
| `poll_voted` | `option_index` | When user votes |
| `media_uploaded` | `media_type`, `file_size_mb` | When media uploaded |
| `media_viewed` | `media_type` | When media opened |
| `link_preview_viewed` | `domain` | When link preview shown |
| `bookmark_added` | `content_type` | When bookmark created |
| `bookmark_removed` | - | When bookmark deleted |

### Feature Discovery Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `feature_discovered` | `feature_name`, `discovery_method` | When user first sees feature |
| `feature_used` | `feature_name`, `context` | When feature used |
| `menu_opened` | `menu_type`, `screen` | When menu accessed |
| `settings_viewed` | `section` | When settings opened |
| `help_viewed` | `help_topic` | When help accessed |

### Monetization Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `premium_viewed` | `source` | When premium screen viewed |
| `paywall_viewed` | `trigger_feature`, `user_message_count` | When paywall shown |
| `premium_cta_clicked` | `plan_type`, `source` | When CTA clicked |
| `premium_subscribed` | `plan`, `price`, `trial_used` | When subscription completed |
| `premium_cancelled` | `reason`, `days_subscribed` | When sub cancelled |
| `premium_feature_used` | `feature_name` | When premium feature used |

### Error & Performance Events

| Event | Properties | When to Fire |
|-------|-----------|-------------|
| `error_occurred` | `error_type`, `error_message`, `screen` | When error happens |
| `slow_performance` | `operation`, `duration_ms` | When operation > 3s |
| `network_error` | `endpoint`, `status_code` | When API fails |
| `crash_prevented` | `error_boundary`, `component` | When error boundary catches |

---

## 🏷️ User Properties (Super Properties)

Set these properties for every user to segment and filter data:

### Identity Properties
```typescript
{
  user_id: string,          // Unique user ID
  phone: string,            // Hashed phone number
  name: string,             // User display name
  created_at: Date,         // Account creation date
}
```

### Engagement Properties
```typescript
{
  total_messages_sent: number,       // Lifetime messages
  total_chats: number,               // Number of chats user is in
  total_ai_interactions: number,     // AI feature usage count
  total_voice_calls: number,         // Voice call participation
  days_since_signup: number,         // Account age
  last_active_date: Date,            // Last activity timestamp
  preferred_language: string,        // Translation preference
}
```

### Behavioral Properties
```typescript
{
  has_completed_onboarding: boolean,
  has_sent_message: boolean,
  has_created_chat: boolean,
  has_used_ai_feature: boolean,
  has_made_voice_call: boolean,
  has_invited_friend: boolean,
  favorite_feature: string,          // Most used feature
  avg_messages_per_day: number,
  avg_session_duration_minutes: number,
}
```

### Monetization Properties
```typescript
{
  is_premium: boolean,
  premium_plan: string | null,
  premium_since: Date | null,
  lifetime_value: number,
  has_seen_paywall: boolean,
  paywall_views_count: number,
}
```

### Device Properties
```typescript
{
  platform: 'ios' | 'android',
  app_version: string,
  device_model: string,
  os_version: string,
  timezone: string,
}
```

---

## 📈 Key Dashboards to Create in PostHog

### 1. **Activation Dashboard**
- New signups (daily/weekly trend)
- Onboarding completion rate
- Time to first message
- % who send message within 24h
- Drop-off by onboarding step

### 2. **Engagement Dashboard**
- Daily/Weekly Active Users
- Messages sent per user
- AI feature usage rate
- Voice call participation
- Average session duration
- Feature adoption matrix

### 3. **Retention Dashboard**
- Day 1, 7, 30 retention curves
- Cohort analysis by signup week
- Churn prediction signals
- Return user behavior patterns
- Notification→app open rate

### 4. **Monetization Dashboard**
- Premium conversion funnel
- Paywall view→subscribe rate
- Revenue by cohort
- Premium feature usage
- Churn rate and reasons
- Average revenue per user (ARPU)

### 5. **Product Health Dashboard**
- Error rates by screen
- API response times
- Crash-free rate
- Performance metrics
- Network error rates

---

## 🎯 Recommended Funnels to Track

### Activation Funnel
```
Sign Up → Complete Onboarding → Join/Create Chat → Send First Message → Send 5 Messages
```

### AI Feature Adoption Funnel
```
See AI Feature → Click AI Feature → Generate Result → Share/Use Result → Return to Feature
```

### Monetization Funnel
```
Use Free Feature → Hit Limit → See Paywall → Click Subscribe → Complete Payment → Use Premium
```

### Referral Funnel
```
Click Invite → Generate Link → Share Link → Friend Opens → Friend Signs Up → Friend Sends Message
```

---

## 🔍 Key Insights to Extract

### Activation Insights
- What % of users complete onboarding?
- How long does it take to send first message?
- Which acquisition channel has best activation rate?
- What causes onboarding drop-off?

### Engagement Insights
- Which features drive the most engagement?
- What's the correlation between AI usage and retention?
- How does voice call usage affect stickiness?
- What behavior predicts power users?

### Retention Insights
- What do retained vs churned users do differently?
- Which features keep users coming back?
- How does notification engagement affect retention?
- When do users typically churn?

### Monetization Insights
- Which features drive premium conversions?
- What's the optimal paywall timing?
- How does premium affect engagement?
- What's the lifetime value by acquisition channel?

---

## ⚡ Quick Wins: Implement These First

### Week 1 Priorities
1. ✅ Set up user identification in UserContext
2. ✅ Track signup and onboarding events
3. ✅ Track first message sent (activation)
4. ✅ Track message sent with basic properties
5. ✅ Set up basic user properties

### Week 2 Priorities
6. Track AI feature usage (catch-up, TLDR, translate)
7. Track voice call events
8. Track chat creation and joining
9. Set up activation funnel
10. Create engagement dashboard

### Week 3 Priorities
11. Track premium events (views, subscriptions)
12. Track reaction and reply events
13. Track error and performance events
14. Set up retention cohorts
15. Create monetization funnel

---

## 🚨 Common Pitfalls to Avoid

### ❌ DON'T:
- Track message content (privacy violation)
- Track PII in event properties
- Create too many similar events
- Use inconsistent naming
- Track everything without a plan
- Ignore user privacy preferences

### ✅ DO:
- Track message metadata (length, type, etc.)
- Use consistent snake_case naming
- Group related events logically
- Document every event
- Respect user privacy
- Plan before implementing
- Test events in PostHog dashboard

---

## 📱 Implementation Priority Matrix

| Priority | Event Category | Impact | Effort |
|----------|---------------|--------|--------|
| P0 | User lifecycle (signup, onboarding) | ⭐⭐⭐⭐⭐ | Low |
| P0 | Message sent (activation) | ⭐⭐⭐⭐⭐ | Low |
| P1 | AI feature usage | ⭐⭐⭐⭐ | Medium |
| P1 | Chat creation/joining | ⭐⭐⭐⭐ | Low |
| P1 | Voice calls | ⭐⭐⭐⭐ | Medium |
| P2 | Premium/monetization | ⭐⭐⭐⭐⭐ | Low |
| P2 | Reactions and replies | ⭐⭐⭐ | Low |
| P2 | Error tracking | ⭐⭐⭐⭐ | Medium |
| P3 | Content events (polls, events) | ⭐⭐⭐ | Medium |
| P3 | Discovery events | ⭐⭐ | Low |

---

## 🎯 Success Criteria

Your tracking implementation is successful when:

✅ User identification works on signup
✅ All P0 events are tracked and verified
✅ Activation funnel shows accurate data
✅ User properties update correctly
✅ No PII is tracked in events
✅ Events appear in PostHog within 5 seconds
✅ Team can answer key product questions from data
✅ Dashboards load quickly and show insights

---

## 📚 Next Steps

1. **Review this strategy** with your team
2. **Implement user identification** (see POSTHOG_IMPLEMENTATION.md)
3. **Start with P0 events** (signup, onboarding, first message)
4. **Create activation funnel** in PostHog dashboard
5. **Test events** thoroughly before rolling out
6. **Document learnings** and iterate

Ready to implement? See `POSTHOG_IMPLEMENTATION_COMPLETE.md` for code examples!
