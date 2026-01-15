# PostHog Tracking Code Snippets

Ready-to-use code snippets for tracking key events in your VibeChat app.

---

## 🔐 User Authentication Tracking

### Phone Auth Screen
```typescript
// src/screens/PhoneAuthScreen.tsx

import { useAnalytics } from '@/hooks/useAnalytics';

function PhoneAuthScreen() {
  const analytics = useAnalytics();

  const handleSignIn = async (phone: string) => {
    try {
      await signIn(phone);
      
      // Track successful sign in
      analytics.capture('user_signed_in', {
        method: 'phone'
      });
      
      navigation.navigate('Birthdate');
    } catch (error) {
      // Track error
      analytics.capture('error_occurred', {
        error_type: 'auth_failed',
        screen: 'phone_auth'
      });
    }
  };

  return (
    // ... your UI
  );
}
```

### Sign Up Tracking
```typescript
// After successful signup

analytics.capture('user_signed_up', {
  method: 'phone',
  referrer: referralSource // if you track referrals
});
```

---

## 🚀 Onboarding Tracking

### Onboarding Name Screen
```typescript
// src/screens/OnboardingNameScreen.tsx

import { useAnalytics, useScreenTracking } from '@/hooks/useAnalytics';

function OnboardingNameScreen() {
  useScreenTracking('OnboardingName');
  const analytics = useAnalytics();

  const handleContinue = async (name: string, bio?: string) => {
    analytics.capture('onboarding_step_completed', {
      step_name: 'name',
      step_number: 1,
      has_bio: !!bio
    });

    navigation.navigate('OnboardingPhoto');
  };

  return (
    // ... your UI
  );
}
```

### Onboarding Photo Screen
```typescript
// src/screens/OnboardingPhotoScreen.tsx

function OnboardingPhotoScreen() {
  useScreenTracking('OnboardingPhoto');
  const analytics = useAnalytics();

  const handleComplete = async (hasPhoto: boolean) => {
    const startTime = useRef(Date.now());
    const timeTaken = Math.floor((Date.now() - startTime.current) / 1000);

    analytics.capture('onboarding_step_completed', {
      step_name: 'photo',
      step_number: 2,
      has_photo: hasPhoto
    });

    // Onboarding completion is tracked automatically in UserContext
    await updateUser({ hasCompletedOnboarding: true });

    navigation.navigate('ChatList');
  };

  return (
    // ... your UI
  );
}
```

---

## 💬 Messaging Tracking

### Send Message
```typescript
// In ChatScreen.tsx, when sending a message

const handleSendMessage = async (messageText: string) => {
  try {
    const message = await sendMessage({
      chatId,
      text: messageText,
      // ... other fields
    });

    // Track message sent
    analytics.capture('message_sent', {
      type: 'text',
      chat_type: chat.isPersonal ? 'personal' : 'group',
      has_media: false,
      has_mention: messageText.includes('@'),
      has_vibe: !!selectedVibe,
      char_length: messageText.length,
      is_first_message: userMessageCount === 0
    });

    // If this is user's first message ever (activation!)
    if (userMessageCount === 0) {
      analytics.capture('first_message_sent', {
        time_since_signup_minutes: Math.floor((Date.now() - user.createdAt) / 60000)
      });
    }

  } catch (error) {
    analytics.capture('error_occurred', {
      error_type: 'message_send_failed',
      screen: 'chat'
    });
  }
};
```

### Send Media Message
```typescript
const handleSendImage = async (imageUri: string) => {
  analytics.capture('message_sent', {
    type: 'image',
    chat_type: chat.isPersonal ? 'personal' : 'group',
    has_media: true,
    has_vibe: !!selectedVibe,
    media_source: 'gallery' // or 'camera'
  });
};
```

### Add Reaction
```typescript
const handleAddReaction = async (messageId: string, emoji: string) => {
  await addReaction(messageId, emoji);

  analytics.capture('reaction_added', {
    emoji,
    message_type: message.type,
    is_own_message: message.userId === user.id
  });
};
```

### Reply to Message
```typescript
const handleReplyToMessage = (message: Message) => {
  setReplyingTo(message);

  analytics.capture('message_reply_started', {
    message_type: message.type,
    is_own_message: message.userId === user.id
  });
};
```

---

## 🤖 AI Features Tracking

### Catch-Up Feature
```typescript
// In ChatScreen.tsx

const handleOpenCatchUp = async () => {
  analytics.capture('catch_up_viewed', {
    unread_count: unreadCount,
    time_away_hours: Math.floor(timeAway / 3600000)
  });

  if (!cachedSummary) {
    const startTime = Date.now();
    await generateCatchUp();
    const timeTaken = Date.now() - startTime;

    analytics.capture('catch_up_generated', {
      message_count: messages.length,
      time_taken_ms: timeTaken,
      summary_type: 'personalized'
    });
  }

  setShowCatchUpModal(true);
};
```

### TLDR Summary
```typescript
const handleGenerateTLDR = async () => {
  const startTime = Date.now();

  const summary = await generateTLDR(chatId);

  analytics.capture('tldr_generated', {
    message_count: messages.length,
    time_taken_ms: Date.now() - startTime
  });
};
```

### Translation
```typescript
const handleTranslate = async (message: Message, toLang: string) => {
  const result = await translateMessage(message.id, toLang);

  analytics.capture('translation_used', {
    from_lang: message.detectedLanguage || 'unknown',
    to_lang: toLang,
    auto_detected: !message.detectedLanguage,
    char_length: message.text.length
  });
};
```

### AI Image Generation
```typescript
const handleGenerateImage = async (prompt: string) => {
  const startTime = Date.now();

  try {
    const image = await generateImage(prompt);

    analytics.capture('image_generated', {
      prompt_length: prompt.length,
      success: true,
      time_taken_ms: Date.now() - startTime
    });

    return image;
  } catch (error) {
    analytics.capture('image_generated', {
      prompt_length: prompt.length,
      success: false,
      error_type: error.message
    });
  }
};
```

### AI Message (Assistant)
```typescript
const handleSendAIMessage = async (prompt: string, aiFriendId?: string) => {
  const response = await sendAIMessage({
    chatId,
    prompt,
    aiFriendId
  });

  analytics.capture('ai_message_sent', {
    command: extractCommand(prompt), // e.g., "tldr", "image", etc.
    has_ai_friend: !!aiFriendId,
    persona_name: aiFriend?.name,
    prompt_length: prompt.length
  });
};
```

---

## 🎙️ Voice Call Tracking

### Start Voice Call
```typescript
// In voice call component

const handleStartCall = async () => {
  const callStartTime = Date.now();

  analytics.capture('voice_call_started', {
    participant_count: participants.length,
    call_type: 'group' // or 'personal'
  });

  // When call ends
  const handleEndCall = () => {
    const durationSeconds = Math.floor((Date.now() - callStartTime) / 1000);

    analytics.capture('voice_call_ended', {
      duration_seconds: durationSeconds,
      participant_count: participants.length
    });
  };
};
```

### Join Voice Call
```typescript
const handleJoinCall = async (roomId: string) => {
  const joinTime = Date.now();

  await joinRoom(roomId);

  analytics.capture('voice_call_joined', {
    room_id: roomId,
    was_invited: !!inviteLink
  });
};
```

---

## 💰 Premium/Monetization Tracking

### View Premium Screen
```typescript
// In Premium/Paywall Screen

function PremiumScreen() {
  useScreenTracking('Premium');
  const analytics = useAnalytics();

  useEffect(() => {
    analytics.capture('premium_viewed', {
      source: route.params?.source || 'unknown'
    });
  }, []);

  return (
    // ... your UI
  );
}
```

### Show Paywall
```typescript
const showPaywall = (triggerFeature: string) => {
  analytics.capture('paywall_viewed', {
    trigger_feature: triggerFeature,
    user_message_count: userStats.totalMessages,
    days_since_signup: daysSinceSignup
  });

  navigation.navigate('Premium', { source: triggerFeature });
};
```

### Subscribe to Premium
```typescript
const handleSubscribe = async (plan: 'monthly' | 'yearly') => {
  try {
    await subscribe(plan);

    analytics.capture('premium_subscribed', {
      plan,
      price: plan === 'monthly' ? 9.99 : 99.99,
      had_trial: usedFreeTrial
    });

    // Update user properties
    analytics.setUserProperties({
      is_premium: true,
      premium_plan: plan,
      premium_since: new Date().toISOString()
    });

  } catch (error) {
    analytics.capture('error_occurred', {
      error_type: 'subscription_failed',
      plan
    });
  }
};
```

### Use Premium Feature
```typescript
const handleUsePremiumFeature = (featureName: string) => {
  if (!user.isPremium) {
    analytics.capture('premium_feature_attempted', {
      feature_name: featureName,
      is_locked: true
    });
    showPaywall(featureName);
    return;
  }

  analytics.capture('premium_feature_used', {
    feature_name: featureName
  });

  // Execute feature...
};
```

---

## 👥 Social Features Tracking

### Create Chat
```typescript
const handleCreateChat = async (chatData: CreateChatRequest) => {
  const chat = await createChat(chatData);

  analytics.capture('chat_created', {
    type: chatData.isPersonal ? 'personal' : 'group',
    initial_member_count: chatData.memberIds.length
  });

  navigation.navigate('Chat', { chatId: chat.id });
};
```

### Join Chat via Invite
```typescript
const handleJoinChatViaInvite = async (inviteToken: string) => {
  const chat = await joinChatWithToken(inviteToken);

  analytics.capture('chat_joined', {
    join_method: 'invite_link',
    member_count: chat.memberCount
  });

  analytics.capture('invite_accepted', {
    chat_id: chat.id
  });

  navigation.navigate('Chat', { chatId: chat.id });
};
```

### Send Invite
```typescript
const handleShareInvite = async () => {
  const inviteLink = await generateInviteLink(chatId);

  await Share.share({
    message: `Join my chat on VibeChat: ${inviteLink}`
  });

  analytics.capture('invite_sent', {
    method: 'share_sheet',
    chat_type: chat.isPersonal ? 'personal' : 'group'
  });
};
```

---

## 📊 Content Features Tracking

### Create Event
```typescript
const handleCreateEvent = async (eventData: CreateEventRequest) => {
  const event = await createEvent(eventData);

  analytics.capture('event_created', {
    has_date: !!eventData.date,
    has_location: !!eventData.location,
    has_reminder: !!eventData.reminder
  });
};
```

### RSVP to Event
```typescript
const handleRSVP = async (eventId: string, response: 'yes' | 'no' | 'maybe') => {
  await rsvpToEvent(eventId, response);

  analytics.capture('event_rsvp', {
    response_type: response
  });
};
```

### Create Poll
```typescript
const handleCreatePoll = async (pollData: CreatePollRequest) => {
  const poll = await createPoll(pollData);

  analytics.capture('poll_created', {
    option_count: pollData.options.length,
    allow_multiple: pollData.allowMultiple
  });
};
```

### Vote on Poll
```typescript
const handleVote = async (pollId: string, optionIndex: number) => {
  await voteOnPoll(pollId, optionIndex);

  analytics.capture('poll_voted', {
    option_index: optionIndex
  });
};
```

---

## 🔍 Discovery & Navigation Tracking

### Screen View Tracking
```typescript
// In any screen component

import { useScreenTracking } from '@/hooks/useAnalytics';

function MyScreen() {
  // Automatically tracks when screen is viewed
  useScreenTracking('MyScreen', {
    // Optional: add properties
    source: route.params?.source
  });

  return (
    // ... your UI
  );
}
```

### Feature Discovery
```typescript
const handleFeatureDiscovery = (featureName: string, discoveryMethod: string) => {
  analytics.capture('feature_discovered', {
    feature_name: featureName,
    discovery_method: discoveryMethod // 'menu', 'tooltip', 'onboarding', etc.
  });
};
```

### Menu Interaction
```typescript
const handleMenuOpen = (menuType: string) => {
  analytics.capture('menu_opened', {
    menu_type: menuType,
    screen: currentScreen
  });
};
```

---

## 🐛 Error Tracking

### Error Boundary
```typescript
// In your error boundary component

const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
  analytics.capture('error_occurred', {
    error_type: error.name,
    error_message: error.message,
    component_stack: errorInfo.componentStack.split('\n')[1], // First line only
    screen: getCurrentScreen()
  });

  // Log to your error tracking service
  console.error('Error caught by boundary:', error, errorInfo);
};
```

### API Error Tracking
```typescript
// In your API client

const apiClient = {
  get: async (url: string) => {
    try {
      const response = await fetch(url);
      return response.json();
    } catch (error) {
      analytics.capture('network_error', {
        endpoint: url,
        error_type: error.name,
        status_code: error.response?.status
      });
      throw error;
    }
  }
};
```

### Slow Performance Tracking
```typescript
const trackPerformance = (operationName: string, startTime: number) => {
  const duration = Date.now() - startTime;

  if (duration > 3000) { // Slower than 3 seconds
    analytics.capture('slow_performance', {
      operation: operationName,
      duration_ms: duration
    });
  }
};

// Usage
const startTime = Date.now();
await someSlowOperation();
trackPerformance('some_slow_operation', startTime);
```

---

## 📈 Incrementing User Properties

### Track Cumulative Stats
```typescript
// After sending a message
analytics.setUserProperties({
  total_messages_sent: (user.totalMessagesSent || 0) + 1
});

// After joining a chat
analytics.setUserProperties({
  total_chats: (user.totalChats || 0) + 1
});

// After using AI feature
analytics.setUserProperties({
  total_ai_interactions: (user.totalAIInteractions || 0) + 1
});
```

---

## 🎯 Putting It All Together

### Example: Complete ChatScreen Integration
```typescript
// src/screens/ChatScreen.tsx

import { useAnalytics, useScreenTracking } from '@/hooks/useAnalytics';

function ChatScreen({ route }) {
  const { chatId } = route.params;
  const analytics = useAnalytics();

  // Auto-track screen view
  useScreenTracking('Chat', {
    chat_id: chatId,
    chat_type: chat?.isPersonal ? 'personal' : 'group'
  });

  // Track message send
  const handleSendMessage = async (text: string) => {
    await sendMessage({ chatId, text });

    analytics.capture('message_sent', {
      type: 'text',
      chat_type: chat.isPersonal ? 'personal' : 'group',
      has_mention: text.includes('@'),
      char_length: text.length
    });
  };

  // Track AI usage
  const handleOpenCatchUp = async () => {
    analytics.capture('catch_up_viewed', {
      unread_count: unreadCount
    });

    await generateCatchUp();

    analytics.capture('catch_up_generated', {
      message_count: messages.length
    });
  };

  // Track reactions
  const handleReact = async (messageId: string, emoji: string) => {
    await addReaction(messageId, emoji);

    analytics.capture('reaction_added', {
      emoji
    });
  };

  return (
    // ... your UI
  );
}
```

---

## ✅ Testing Your Tracking

```typescript
// Test event in any component

const testAnalytics = () => {
  analytics.capture('test_event', {
    timestamp: new Date().toISOString(),
    test: true
  });
  
  console.log('✅ Test event sent! Check PostHog dashboard.');
};

// Usage: Add a hidden button or dev menu item
<Pressable onLongPress={testAnalytics}>
  <Text>Logo</Text>
</Pressable>
```

---

**Ready to implement?** Copy these snippets into your components and start tracking! Remember to check the PostHog dashboard to verify events are coming through.

For more details, see:
- `POSTHOG_TRACKING_STRATEGY.md` - Complete tracking strategy
- `POSTHOG_SETUP.md` - Setup guide
- `POST HOG_TROUBLESHOOTING.md` - Troubleshooting help
