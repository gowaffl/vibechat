# Subscription Management Guide

## ✅ What's Been Set Up

Your VibeChat app now has **full subscription management** capabilities powered by RevenueCat. Users can manage their entire subscription lifecycle directly from the app.

---

## 🎯 Features Implemented

### 1. **Automatic 7-Day Pro Trial**
- ✅ Every new user automatically gets a 7-day Pro trial when they sign up
- ✅ No manual activation required - it starts when the user creates their account
- ✅ Trial status is clearly shown with a banner on the subscription screen
- ✅ Countdown shows days remaining before trial expires

### 2. **RevenueCat Customer Center Integration**
Users can access the **Customer Center** (RevenueCat's pre-built subscription management UI) to:

- **View Subscription Details**
  - Current plan (Free, Plus, or Pro)
  - Next billing date
  - Subscription status
  
- **Manage Payment**
  - Update payment method
  - View billing history
  - Download receipts
  
- **Change Plans**
  - Upgrade from Free → Plus or Pro
  - Upgrade from Plus → Pro
  - Downgrade from Pro → Plus or Free
  - Plans can be changed in-app or through Customer Center
  
- **Cancel Subscription**
  - Cancel anytime with no penalty
  - Keep access until end of current billing period
  - Clear information about when access ends

### 3. **In-App Subscription Screen**

Located at: `/src/screens/SubscriptionScreen.tsx`

**Features:**
- **Status Banner** - Shows current plan (Trial, Pro, Plus) with quick "Manage" button
- **Usage Dashboard** - Real-time tracking of:
  - Daily personal messages
  - Monthly image generations
  - Monthly AI calls
  - Visual progress bars showing usage vs. limits
  
- **Plan Comparison** - Interactive cards showing:
  - Free plan features and limits
  - Plus plan (5x limits, $5/mo)
  - Pro plan (unlimited features, Vibe Calls, $20/mo)
  
- **Subscription Management Section** (for active subscribers)
  - Quick access to Customer Center
  - Explanation of what users can do:
    - View billing history
    - Update payment
    - Change plan
    - Cancel subscription
  
- **Upgrade/Downgrade** - One-tap plan changes with confirmation
- **Restore Purchases** - Recover subscriptions on new devices

---

## 🚀 How Users Manage Their Subscription

### For Active Subscribers (Plus or Pro)

1. **Open the Subscription Screen**
   - Tap their profile/settings
   - Navigate to "Subscription" or "Billing"

2. **View Current Status**
   - See current plan in the banner at the top
   - View usage statistics
   - See next billing date

3. **Access Customer Center**
   - Tap "Manage or Cancel Subscription" button
   - Or tap "Manage" in the status banner
   - Or tap the external link icon in the header

4. **In Customer Center, they can:**
   - **Change Plan**: Switch between Plus and Pro
   - **Update Payment**: Change credit card or payment method
   - **View Invoices**: Download receipts and billing history
   - **Cancel**: Cancel subscription (keeps access until period ends)

### For Free Users

1. **View Plans** - See comparison of Free, Plus, and Pro
2. **Select a Plan** - Tap on the plan card to select
3. **Subscribe** - Tap the "Subscribe to [Plan Name]" button
4. **Complete Purchase** - Follow the App Store/Play Store flow
5. **Instant Access** - Features unlock immediately

### For Trial Users

1. **See Trial Status** - Banner shows "Pro Trial Active" with days remaining
2. **Subscribe Before Trial Ends** - Choose Plus or Pro before trial expires
3. **Or Let It Expire** - Automatically downgrade to Free after 7 days

---

## 🎨 User Interface Elements

### Top Banner (Status Card)
```
┌─────────────────────────────────────────┐
│ 👑 VibeChat Pro              [Manage]  │
│ Renews on Jan 27, 2026                 │
└─────────────────────────────────────────┘
```

### Usage Dashboard
```
┌─────────────────────────────────────────┐
│ CURRENT USAGE                           │
├─────────────────────────────────────────┤
│ Personal Messages (Today)    12 / 25   │
│ ▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░             │
│                                         │
│ Image Generations (Monthly)   3 / 5    │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░             │
│                                         │
│ AI Calls (Monthly)           15 / 25   │
│ ▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░             │
└─────────────────────────────────────────┘
```

### Management Info Card (for active subscribers)
```
┌─────────────────────────────────────────┐
│ 🔗 MANAGE YOUR SUBSCRIPTION             │
├─────────────────────────────────────────┤
│ In the subscription manager you can:    │
│ • View billing history and receipts     │
│ • Update payment method                 │
│ • Change your subscription plan         │
│ • Cancel your subscription              │
│                                         │
│ If you cancel, you'll still have access │
│ until the end of your billing period.   │
└─────────────────────────────────────────┘
```

### Plan Cards
```
┌─────────────────────────────────────────┐
│  ⚡ Plus            $5/mo              │
├─────────────────────────────────────────┤
│ 💬 Personal messages    125/day   5x   │
│ 🖼️  Image generations   25/month  5x   │
│ 🤖 AI calls             125/month 5x   │
│ 🎤 Vibe Calls           —              │
└─────────────────────────────────────────┘
```

### Bottom Actions
```
┌─────────────────────────────────────────┐
│  [ Upgrade to Pro ]  (gradient button)  │
│  [ Manage or Cancel Subscription ]      │
│                                         │
│  Manage your subscription, update       │
│  payment method, or cancel anytime.     │
└─────────────────────────────────────────┘
```

---

## 🔧 Technical Implementation

### RevenueCat SDK Configuration
- **Package**: `react-native-purchases` v9.7.1
- **UI Package**: `react-native-purchases-ui` v9.7.1
- **API Key**: Configured in `SubscriptionContext.tsx`
- **Customer Center**: Pre-built UI from RevenueCat

### Context Integration
- **File**: `/src/contexts/SubscriptionContext.tsx`
- **Methods**:
  - `presentCustomerCenter()` - Opens subscription management
  - `presentPaywall()` - Shows RevenueCat paywall
  - `purchasePackage(pkg)` - Initiates purchase
  - `restorePurchases()` - Restores on new device

### Backend Support
- **Endpoint**: `/api/subscriptions/:userId`
- **Sync**: Backend stays in sync with RevenueCat webhooks
- **Usage Tracking**: Enforces limits based on subscription tier
- **Trial Management**: Auto-creates trial on signup

---

## 📱 Testing Subscription Management

### Test as a Free User
1. Sign up for a new account
2. Note: You'll automatically get a 7-day Pro trial
3. Go to Subscription screen
4. See trial banner and Pro features

### Test Upgrading
1. Select a plan (Plus or Pro)
2. Tap "Subscribe to [Plan]"
3. Complete sandbox purchase (use test account)
4. See immediate plan upgrade
5. Test Customer Center - tap "Manage"

### Test Downgrading/Canceling
1. As a Pro user, open Customer Center
2. Select "Change Plan" or "Cancel"
3. Follow flow to downgrade to Plus or Free
4. Verify features are restricted appropriately

### Test Restoring
1. Uninstall and reinstall app (or use new device)
2. Sign in with same account
3. Tap "Restore Purchases"
4. Verify subscription is restored

---

## 🎓 RevenueCat Customer Center Features

The Customer Center is a **pre-built, native UI** provided by RevenueCat that automatically handles:

### ✅ What Users See
- Current subscription details
- Next billing date
- Subscription history
- Active features/entitlements

### ✅ What Users Can Do
- **Change Plans**: Upgrade or downgrade
- **Update Payment**: Change credit card
- **Cancel**: End subscription
- **Restore**: Recover purchases on new device
- **Get Help**: Contact support (if configured)

### ✅ Platform Native
- **iOS**: Uses native StoreKit UI
- **Android**: Uses native Google Play Billing UI
- **Handles**: All the complexity of app store billing rules

---

## 💡 Best Practices Implemented

1. **✅ Clear Status Indicators**
   - Users always know what plan they're on
   - Trial status is prominent
   - Next billing date is visible

2. **✅ Easy Access to Management**
   - Multiple entry points (header, banner, bottom button)
   - Clear calls-to-action
   - Helpful explanations

3. **✅ Transparent Pricing**
   - All plans show price upfront
   - Features clearly listed
   - No hidden fees or surprises

4. **✅ Graceful Cancellation**
   - Users keep access until period ends
   - Clear explanation of what happens
   - Easy to re-subscribe

5. **✅ Cross-Device Support**
   - "Restore Purchases" for new devices
   - Subscription syncs automatically
   - Works on iOS and Android

---

## 🚨 Important Notes

### For iOS
- Customer Center uses **native StoreKit UI**
- Users manage through Apple's subscription interface
- Cancellation must go through App Store settings on iOS (platform requirement)
- RevenueCat Customer Center will show "Manage in App Store" button on iOS

### For Android
- Customer Center uses **native Google Play Billing**
- Users can manage directly in-app
- More flexibility for in-app cancellation
- RevenueCat handles all the Google Play complexity

### Platform Differences
- **iOS**: Apple requires subscriptions to be cancellable via iOS Settings
- **Android**: Google allows more in-app management
- **RevenueCat**: Automatically adapts to each platform's requirements

---

## 📚 Additional Resources

- **RevenueCat Docs**: https://docs.revenuecat.com/
- **Customer Center Guide**: https://docs.revenuecat.com/docs/customer-center
- **React Native SDK**: https://docs.revenuecat.com/docs/reactnative

---

## 🎉 Summary

Your users can now:
- ✅ Start with automatic 7-day Pro trial
- ✅ Subscribe to Plus ($5/mo) or Pro ($20/mo)
- ✅ Manage their subscription completely in-app
- ✅ Upgrade, downgrade, or cancel anytime
- ✅ Update payment methods
- ✅ View billing history
- ✅ Restore purchases on new devices
- ✅ See real-time usage tracking

All subscription management is handled by RevenueCat's battle-tested infrastructure, ensuring compliance with App Store and Google Play requirements.
