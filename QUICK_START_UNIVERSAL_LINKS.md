# Quick Start: Universal Links for VibeChat

## 🎯 TL;DR - What You Need To Do

### 1. Verify Team ID (2 minutes)
Open Xcode → Your Project → Signing & Capabilities → Check Team ID

**Is it `areyeswaffl`?**
- ✅ Yes → Skip to step 2
- ❌ No → Update `backend/src/index.ts` lines 107, 113, 123, 129 with your Team ID

### 2. Deploy Backend (5 minutes)
```bash
cd backend
git add .
git commit -m "Add universal links support"
git push
```

**Verify it worked:**
Visit: https://vibechat-zdok.onrender.com/.well-known/apple-app-site-association
Should see JSON with your app info.

### 3. Build iOS App (30-60 minutes)
```bash
eas build --platform ios --profile production --auto-submit
```

### 4. Test on TestFlight (5 minutes)
1. Install from TestFlight
2. Send yourself a link in Messages: `https://vibechat-zdok.onrender.com/invite/test`
3. Tap it → App should open directly

**Done!** 🎉

---

## 🔗 What Changed

### Before:
- Links: `vibechat://invite?token=abc123`
- ❌ Doesn't work reliably
- ❌ No web fallback
- ❌ Looks suspicious

### After:
- Links: `https://vibechat-zdok.onrender.com/invite/abc123`
- ✅ Works everywhere
- ✅ Beautiful web fallback
- ✅ Professional appearance
- ✅ App Store redirect for non-users

---

## 🧪 Quick Test

After installing from TestFlight:

```
1. Open Messages app
2. Send yourself: https://vibechat-zdok.onrender.com/invite/test
3. Tap the link
4. Expected: VibeChat opens directly
```

If it opens Safari instead:
- Uninstall app
- Reinstall from TestFlight
- Try again

---

## 🆘 Troubleshooting

### Links open in browser instead of app?
1. Check AASA is accessible: https://vibechat-zdok.onrender.com/.well-known/apple-app-site-association
2. Verify Team ID matches
3. Reinstall app (universal links register on install)

### AASA returns 404?
- Backend deployment didn't complete
- Check Render dashboard for errors
- Redeploy backend

### Still not working?
See full docs: `DEPLOYMENT_CHECKLIST.md` and `UNIVERSAL_LINKS_IMPLEMENTATION.md`

---

## 📱 Build Command

```bash
eas build --platform ios --profile production --auto-submit
```

That's it! Your app now has production-ready deep linking. 🚀
