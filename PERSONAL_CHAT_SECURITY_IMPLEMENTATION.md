# Personal Chat AI Security Implementation

## Overview
This document describes the security guardrails implemented for personal chat AI responses to ensure they match the safety measures already in place for group chat AI responses.

## Security Gap Identified
**CRITICAL**: Personal chat AI responses had **NO safety guardrails** while group chat had comprehensive protections against harmful content, illegal activities, health/medical advice, and age-inappropriate content.

## Security Measures Implemented

### 1. Content Safety Checks (Input Validation)
**Location**: `backend/src/routes/personal-chats.ts`

Both personal chat endpoints now include:

#### Crisis Detection (CRIT-2)
- Detects suicide/self-harm mentions
- Returns crisis hotline resources instead of blocking
- Provides immediate help information (988 in US, regional resources)
- Does NOT block - provides compassionate support

#### Content Blocking (CRIT-1)
Blocks and returns error for:
- Violence against others
- Criminal activity (hacking, fraud, illegal substances)
- Explicit sexual content
- Dangerous activities (weapons, explosives)
- Specific medical diagnoses/treatments
- Specific legal advice

#### Age Protection (CRIT-3)
- Checks user age via `getUserAgeContext()`
- Additional restrictions for users under 18
- Age-appropriate content enforcement

### 2. AI Safety System Prompts
**Location**: `backend/src/services/gpt-streaming-service.ts`

Updated `buildPersonalChatSystemPrompt()` to include:
- Absolute restrictions (never provide harmful information)
- Crisis response guidelines (encourage professional help)
- Medical/legal advice limitations
- Age-appropriate content guidelines for minors
- Graceful decline strategies

### 3. Output Filtering
**Location**: `backend/src/routes/personal-chats.ts`

Both endpoints now filter AI responses:
- Detects dangerous patterns in AI output
- Catches edge cases where AI might bypass system prompts
- Replaces harmful content with safe alternatives
- Logs safety events for compliance

### 4. Safety Logging
All safety events are logged with:
- Event type (crisis, blocked, filtered)
- User ID and conversation ID
- Timestamp and flags
- Compliance audit trail

## Implementation Details

### Regular POST Endpoint
`POST /api/personal-chats/:conversationId/messages`

**Changes:**
1. Added `getUserAgeContext()` check
2. Added `checkContentSafety()` validation
3. Returns crisis response or blocks content as needed
4. Updated system prompt to use `buildPersonalChatSystemPrompt()` with safety guidelines
5. Added `filterAIOutput()` before saving AI response
6. Added safety event logging

### Streaming POST Endpoint  
`POST /api/personal-chats/:conversationId/messages/stream`

**Changes:**
1. Added `getUserAgeContext()` check
2. Added `checkContentSafety()` validation
3. Returns crisis response or blocks content as needed
4. Updated `buildPersonalChatSystemPrompt()` call to pass `isMinor` flag
5. Added `filterAIOutput()` before saving streaming response
6. Added safety event logging

### System Prompt Builder
`buildPersonalChatSystemPrompt()` in `gpt-streaming-service.ts`

**Changes:**
1. Added `isMinor` parameter
2. Imports and includes `getSafetySystemPrompt(isMinor)`
3. Safety guidelines now prepended to all personal chat prompts
4. Same safety instructions as group chat

## Safety Features Comparison

| Feature | Group Chat | Personal Chat (Before) | Personal Chat (After) |
|---------|------------|----------------------|---------------------|
| Crisis Detection | ✅ | ❌ | ✅ |
| Violence Blocking | ✅ | ❌ | ✅ |
| Criminal Activity Blocking | ✅ | ❌ | ✅ |
| Medical Advice Limitations | ✅ | ❌ | ✅ |
| Legal Advice Limitations | ✅ | ❌ | ✅ |
| Age-Appropriate Content | ✅ | ❌ | ✅ |
| AI Safety System Prompts | ✅ | ❌ | ✅ |
| Output Filtering | ✅ | ❌ | ✅ |
| Safety Event Logging | ✅ | ❌ | ✅ |

## Pattern Detection

### Crisis Patterns Detected
- "want to kill myself"
- "planning to end my life"
- "no reason to live"
- "better off dead"
- And 15+ other patterns

### Violence Patterns Detected
- "how to hurt someone"
- "planning to attack"
- "make a bomb"
- And more

### Criminal Patterns Detected
- "how to hack"
- "sell drugs"
- "commit fraud"
- And more

### Medical Patterns Detected
- Requests for diagnoses
- Medication dosage questions
- Treatment recommendations
- And more

## Response Examples

### Crisis Detected
```json
{
  "crisis": true,
  "response": "I'm really concerned about what you're sharing. Please reach out for help:\n\n🆘 National Suicide Prevention Lifeline: 988\n..."
}
```

### Content Blocked
```json
{
  "blocked": true,
  "reason": "I can't help with anything that could harm others. Let's talk about something else! 💬",
  "flags": ["violence"]
}
```

### Output Filtered
If AI accidentally generates harmful content, it's replaced with:
```
"I can't help with that. If you're going through a difficult time, please reach out to a crisis helpline like 988 (US). You matter. ❤️"
```

## Testing Recommendations

1. **Crisis Detection Test**
   - Send message: "I don't want to live anymore"
   - Should receive crisis resources

2. **Violence Blocking Test**
   - Send message: "How do I hurt someone?"
   - Should be blocked with appropriate message

3. **Medical Advice Test**
   - Send message: "What medication should I take for headaches?"
   - AI should decline and recommend consulting a doctor

4. **Minor Protection Test**
   - Test with account under 18
   - Should have additional content restrictions

5. **Normal Conversation Test**
   - Send message: "What's the weather like?"
   - Should respond normally

## Files Modified

1. `/backend/src/routes/personal-chats.ts`
   - Added safety imports
   - Added content safety checks to both endpoints
   - Added output filtering
   - Updated system prompt building

2. `/backend/src/services/gpt-streaming-service.ts`
   - Updated `buildPersonalChatSystemPrompt()` signature
   - Added `isMinor` parameter
   - Integrated `getSafetySystemPrompt()`

## Dependencies

All safety features use existing services:
- `backend/src/services/content-safety.ts` - Core safety service
- No new dependencies required
- Same patterns and logic as group chat

## Compliance Notes

- All safety events are logged for audit trails
- Crisis situations are logged separately for compliance
- User age is checked and respected
- Regional crisis resources provided (US, UK, CA, AU, DEFAULT)

## Summary

Personal chat AI responses now have **complete parity** with group chat security measures. All guardrails for health advice, illegal activities, harmful content, and age-appropriate content are in place and functioning.

**Status**: ✅ COMPLETE - Personal chat is now as secure as group chat
