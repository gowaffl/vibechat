# VibeChat Production Deployment Checklist

## ✅ Build Number Updated
- iOS Build Number: **6** (updated in `app.json`)
- Ready for TestFlight submission

---

## 🔗 Universal Links Implementation Complete

### What Was Done:
1. ✅ Added Apple App Site Association (AASA) endpoints to backend
2. ✅ Updated `app.json` with `associatedDomains`
3. ✅ Changed invite links from `vibechat://` to `https://`
4. ✅ Added beautiful web fallback pages
5. ✅ Updated all invite sharing UI

### Files Modified:
- `backend/src/index.ts` - AASA endpoints + web landing pages
- `backend/src/routes/chats.ts` - Universal link generation
- `app.json` - Associated domains configuration
- `App.tsx` - Universal link prefix
- `src/screens/ChatScreen.tsx` - Share invite UI
- `src/screens/GroupSettingsMembersScreen.tsx` - Share invite UI

---

## 📋 Pre-Deployment Steps

### 1. Verify Apple Team ID
Your current Team ID in the code: `areyeswaffl`

**How to verify:**
```bash
# Open your iOS project in Xcode
cd ios
open VibeChat.xcworkspace

# Or check in Xcode:
# Project Target → Signing & Capabilities → Team
```

If your Team ID is different, update these lines in `backend/src/index.ts`:
- Line ~107: `appID: "YOUR_TEAM_ID.com.vibecodeapp.vibechat"`
- Line ~123: `appID: "YOUR_TEAM_ID.com.vibecodeapp.vibechat"`
- Line ~113: `apps: ["YOUR_TEAM_ID.com.vibecodeapp.vibechat"]`
- Line ~129: `apps: ["YOUR_TEAM_ID.com.vibecodeapp.vibechat"]`

### 2. Update App Store Link (Optional but Recommended)
The web landing pages currently use a placeholder App Store link. Update it once your app is live:

In `backend/src/index.ts`, find and replace:
```
https://apps.apple.com/app/vibechat/id6738968754
```

With your actual App Store link (format: `https://apps.apple.com/app/vibechat/idYOUR_APP_ID`)

### 3. Deploy Backend First
```bash
cd backend

# If using Render (your current setup):
git add .
git commit -m "Add universal links support"
git push

# Or deploy via Render dashboard
```

**Verify deployment:**
1. Visit: https://vibechat-zdok.onrender.com/.well-known/apple-app-site-association
2. Should return JSON with your appID
3. Visit: https://vibechat-zdok.onrender.com/invite/test
4. Should show beautiful landing page

### 4. Build iOS App
```bash
# From project root
eas build --platform ios --profile production --auto-submit
```

This will:
- Build with production profile
- Use build number 6
- Include universal links configuration
- Auto-submit to TestFlight

---

## 🧪 Testing Universal Links

### After TestFlight Install:

**Important**: Universal links require a fresh install to register properly. If updating an existing install, uninstall first.

### Test Scenarios:

#### 1. Test from Messages
```
1. Open Messages app
2. Send yourself: https://vibechat-zdok.onrender.com/invite/testtoken
3. Tap the link
4. Expected: App opens directly (no browser)
```

#### 2. Test from Notes
```
1. Open Notes app
2. Create note with link: https://vibechat-zdok.onrender.com/invite/testtoken
3. Long press → should show "Open in VibeChat"
4. Tap → app opens directly
```

#### 3. Test from Safari
```
1. Open Safari
2. Navigate to: https://vibechat-zdok.onrender.com/invite/testtoken
3. Expected: Universal link intercepts before page loads
4. App opens directly
```

#### 4. Test Real Invite Flow
```
1. Open VibeChat
2. Go to any chat
3. Tap share/invite button
4. Share link via Messages to another device
5. Recipient taps link
6. Expected: App opens to invite screen
```

### If Universal Links Don't Work:

1. **Check AASA is accessible**
   - Visit: https://vibechat-zdok.onrender.com/.well-known/apple-app-site-association
   - Must return valid JSON (not 404)

2. **Verify Team ID matches**
   - Check Xcode signing settings
   - Must exactly match AASA file

3. **Reinstall app**
   - Universal links register on install
   - Uninstall → Reinstall from TestFlight

4. **Check device logs**
   ```
   - Connect device to Mac
   - Open Console.app
   - Filter for "swcd"
   - Look for AASA download attempts
   ```

5. **Wait for iOS cache**
   - iOS caches AASA files for ~24 hours
   - Changes may take time to propagate

---

## 🎯 What Users Will See

### With App Installed:
1. User receives link: `https://vibechat-zdok.onrender.com/invite/abc123`
2. Taps link
3. App opens instantly to invite screen
4. User joins chat
5. ✨ Seamless experience

### Without App Installed:
1. User receives link
2. Taps link
3. Beautiful landing page opens in browser
4. Shows chat info and "Download on App Store" button
5. User downloads app
6. Can use invite code to join

---

## 🔍 Validation Tools

### Apple's AASA Validator
```bash
# Install validator
npm install -g app-site-association-validator

# Validate your domain
validate-aasa vibechat-zdok.onrender.com
```

### Online Validators
- Branch.io: https://branch.io/resources/aasa-validator/
- Apple's validator: https://search.developer.apple.com/appsearch-validation-tool/

### Manual Testing
```bash
# Check AASA is accessible
curl https://vibechat-zdok.onrender.com/.well-known/apple-app-site-association

# Should return JSON like:
{
  "applinks": {
    "apps": [],
    "details": [{
      "appID": "areyeswaffl.com.vibecodeapp.vibechat",
      "paths": ["/invite/*", "/chat/*", "/share"]
    }]
  }
}
```

---

## 📊 Monitoring & Analytics

Consider tracking:
- AASA file requests (iOS devices checking for universal links)
- Web landing page visits (users without app)
- Successful deep link opens
- App Store redirect clicks
- Invite conversion rates

Add analytics to the web landing pages in `backend/src/index.ts` (Google Analytics, Mixpanel, etc.)

---

## 🚨 Common Issues & Solutions

### Issue: Links open in Safari instead of app
**Solution**: 
- Verify AASA is accessible
- Check Team ID matches exactly
- Reinstall app
- Wait for iOS cache to clear (~24 hours)

### Issue: AASA returns 404
**Solution**:
- Verify backend deployment succeeded
- Check route is registered in `backend/src/index.ts`
- Test with curl command above

### Issue: App opens but doesn't navigate to invite
**Solution**:
- Check `App.tsx` linking configuration
- Verify route params match
- Check navigation logs in console

### Issue: "Invalid Invite" error
**Solution**:
- Invite tokens expire after 24 hours
- Generate new invite link
- Check backend invite validation logic

---

## 🎉 Success Criteria

Your universal links are working when:
- ✅ AASA file is accessible via HTTPS
- ✅ Links shared from app use `https://` format
- ✅ Tapping links opens app directly (no browser)
- ✅ Long-press shows "Open in VibeChat"
- ✅ Web fallback works for users without app
- ✅ Invite flow works end-to-end

---

## 📱 EAS Build Command

```bash
eas build --platform ios --profile production --auto-submit
```

**What this does:**
1. Builds iOS app with production configuration
2. Uses build number 6
3. Includes universal links (associatedDomains)
4. Automatically submits to TestFlight
5. Uses production environment variables

**Alternative (build only, submit later):**
```bash
# Build without auto-submit
eas build --platform ios --profile production

# Submit separately
eas submit --platform ios --latest
```

---

## 🔐 Security Notes

- ✅ AASA must be served over HTTPS (already configured)
- ✅ No authentication required for AASA endpoint (by design)
- ✅ Universal links are cryptographically verified by iOS
- ✅ Only your app can handle links from your domain
- ✅ Invite tokens expire after 24 hours (already implemented)

---

## 📚 Documentation

Full implementation details: `UNIVERSAL_LINKS_IMPLEMENTATION.md`

---

## ✅ Final Checklist

Before building:
- [ ] Verify Team ID is correct
- [ ] Deploy backend changes
- [ ] Test AASA endpoint is accessible
- [ ] Update App Store link (optional)

After building:
- [ ] Install from TestFlight
- [ ] Test universal links from Messages
- [ ] Test universal links from Notes
- [ ] Test real invite flow
- [ ] Verify web fallback works

---

## 🚀 Ready to Deploy!

Once you've completed the checklist above, run:

```bash
eas build --platform ios --profile production --auto-submit
```

Your app will have production-ready deep linking! 🎉
