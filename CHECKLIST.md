# Chatsplat — Pre-Launch Checklist
> Work through this top-to-bottom. Sections are ordered by priority.
> App is roughly 75% production-ready. Core features work — see bugs + gaps below.

---

## SECTION 1 — CRITICAL BUGS (Fix these first, they break core features)

### 1.1 — Agora Token Returns Wrong UID
- **File:** `backend/src/routes/rooms.js` (around the `/rooms/:id/agora-token` endpoint)
- **Problem:** Backend returns `uid: 0` instead of the real user UUID
- **Fix:** Change the response to return the actual `user.id` from the DB as `uid`
- **Why it matters:** Agora SDK uses `uid` to identify speakers. With `uid: 0` all users look the same — muting, speaking indicators, and video streams will misfire

### 1.2 — Gift Host Cut Is 0.3% Instead of 30%
- **File:** `backend/src/routes/gifts.js` around line 36
- **Problem:** `(totalCost * 0.30) / 100` — dividing by 100 when the value is already a decimal
- **Fix:** Change to `totalCost * 0.30`
- **Why it matters:** Host earns 3 Spota on a 1,000 Spota gift instead of 300. Hosts are getting ripped off.

### 1.3 — Twilio SMS Is Disabled (OTPs Only Log to Console)
- **File:** `backend/src/routes/auth.js` — OTP sending block
- **Problem:** The Twilio send code is commented out. In prod, OTPs never get delivered to the user's phone.
- **Fix:** Uncomment the Twilio block AND fill in `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE` in your backend `.env`
- **Get credentials from:** https://console.twilio.com

### 1.4 — Spota Purchases Are Not Verified
- **File:** `mobile/src/screens/spota/BuySpoTaScreen.js` lines ~36–39
- **Problem:** Purchase sends `demo_${Date.now()}` as the transaction ID. No receipt validation with Apple/Google.
- **Fix:** Set up RevenueCat (the SDK is already installed: `react-native-purchases`). Replace the demo transaction ID with a real RevenueCat purchase flow.
- **Why it matters:** Anyone can claim any purchase for free without this check.

### 1.5 — Poll Vote Has No Bounds Check
- **File:** `backend/src/routes/feed.js` lines ~90–103
- **Problem:** `option_index` is accepted with no validation against how many options the poll actually has
- **Fix:** Add a check: `if (option_index >= post.options.length) return 400`

---

## SECTION 2 — MISSING SCREENS (App will crash navigating to these)

### 2.1 — NotificationsScreen Does Not Exist
- **Referenced in:** `mobile/src/screens/home/HomeScreen.js` (notification bell)
- **Fix:** Create `mobile/src/screens/notifications/NotificationsScreen.js`
- Backend endpoints already exist: `GET /notifications` and `POST /notifications/read-all`
- Just needs a list view showing notification items with a "mark all read" button

### 2.2 — CreatePostScreen Does Not Exist
- **Referenced in:** `mobile/src/screens/feed/FeedScreen.js` (create post button)
- **Fix:** Create `mobile/src/screens/feed/CreatePostScreen.js`
- Backend already handles: text, image, poll, qa, hmu post types
- Minimum viable: text post + poll support is enough for launch

---

## SECTION 3 — ENVIRONMENT VARIABLES (Nothing works without these)

### Backend `.env` — fill in ALL of these before deploying:
```
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASS@YOUR_HOST:5432/chatsplat
REDIS_URL=redis://YOUR_REDIS_HOST:6379
JWT_SECRET=<random 32+ char string — generate one>
JWT_REFRESH_SECRET=<different random 32+ char string>
AGORA_APP_ID=<from console.agora.io>
AGORA_APP_CERTIFICATE=<from console.agora.io>
TWILIO_ACCOUNT_SID=<from console.twilio.com>
TWILIO_AUTH_TOKEN=<from console.twilio.com>
TWILIO_PHONE=+1XXXXXXXXXX
OPENAI_API_KEY=<from platform.openai.com — optional but recommended>
ALLOWED_ORIGINS=https://your-deployed-api-domain.com
```

### Mobile `eas.json` — update the `preview` and `production` profiles:
- `EXPO_PUBLIC_API_URL` → your deployed backend URL (e.g. `https://api.chatsplat.app`)
- `EXPO_PUBLIC_AGORA_APP_ID` → same Agora App ID as backend (currently says `YOUR_AGORA_APP_ID`)

### For Google Play submission — `mobile/eas.json` submit section:
- `serviceAccountKeyPath` → needs `mobile/google-service-account.json` (see Google Play Console → Setup → API Access)

---

## SECTION 4 — THINGS TO DECIDE / IMPLEMENT

### 4.1 — Push Notifications (Firebase FCM)
- **Status:** Infrastructure exists (FCM token stored, notifications table populated) but nothing actually sends
- **Options:**
  - A) Implement: create a `sendNotification(userId, title, body)` helper using `firebase-admin` and call it in key places (new match, new message, gift received, mic granted)
  - B) Skip for now: Remove Firebase from dependencies to reduce bundle size. Add back later.

### 4.2 — Avatar Upload (Cloudinary)
- **Status:** `CLOUDINARY_*` env vars exist, SDK installed, but no upload endpoint
- **Current behavior:** Users pick from Picsum random photo URLs — no real custom avatars
- **Fix:** Create `POST /users/me/avatar` endpoint that accepts a file, uploads to Cloudinary, returns URL. Then update mobile avatar picker to use this instead of Picsum.

### 4.3 — Agora Token Refresh (Rooms Break After 1 Hour)
- **Problem:** Agora tokens are hardcoded to expire in exactly 1 hour. Long rooms will silently lose audio/video.
- **Fix:** On mobile, set a timer when joining a room. At 55 min, call `POST /rooms/:id/agora-token` again and re-initialize the Agora engine with the new token.

### 4.4 — Stories Feature
- **Status:** Database table exists, no backend endpoints, no mobile screens
- **Decision:** Build it or remove the table to keep the schema clean

### 4.5 — Consistent Mic Slots Display
- **Problem:** AudioRoomScreen shows 8 mic slots, SplatRoomScreen shows 20. Pick one.
- **Default set in backend:** 1–20 allowed. Recommended: match what your room creation UI shows.

---

## SECTION 5 — GOOGLE PLAY STORE SETUP (When you're ready to publish)

### 5.1 — Play Console Setup
- [ ] Create Google Play Developer account at play.google.com/console ($25 one-time fee)
- [ ] Click "Create app" → name it Chatsplat
- [ ] Fill out store listing: description, screenshots (minimum 2), category (Social)
- [ ] Upload icon (512×512 PNG)
- [ ] Complete content rating questionnaire
- [ ] Add privacy policy URL (required — you use camera, mic, and phone number)

### 5.2 — Service Account for EAS Submit
- [ ] In Play Console → Setup → API Access → link a Google Cloud project
- [ ] Create Service Account → grant "Release Manager" role
- [ ] Download JSON key → save as `mobile/google-service-account.json`

### 5.3 — Build & Submit Commands
Run these from the `mobile/` folder:
```bash
# Install EAS CLI (one time)
npm install -g eas-cli
eas login

# Build production .aab
eas build --platform android --profile production

# Submit to Play Store (internal testing track)
eas submit --platform android --profile production
```

### 5.4 — Play Store Release Tracks
Roll out in this order:
1. **Internal Testing** → you + up to 100 testers, instant access
2. **Closed Testing (Alpha)** → invite group, longer test
3. **Open Testing (Beta)** → anyone can opt in
4. **Production** → full rollout (do 10% → 50% → 100% staged)

---

## SECTION 6 — BACKEND DEPLOYMENT CHECKLIST

- [ ] Deploy backend to Render or Railway (render.yaml and railway.toml are both configured)
- [ ] Set all environment variables listed in Section 3
- [ ] Run database migrations after first deploy: `npm run migrate` (or however your migration is run)
- [ ] Hit `GET /health` — should return 200 OK
- [ ] Add SIGTERM handler to `backend/index.js` so the DB connection pool drains cleanly on redeploy (prevents connection exhaustion)

---

## SECTION 7 — CLEANUP / NICE-TO-HAVES (Non-blocking)

- [ ] Remove unused backend dependencies: `cloudinary`, `firebase-admin`, `multer` (if you're not implementing those features soon)
- [ ] Remove unused mobile dependencies: `react-native-gifted-chat`, `react-native-deck-swiper` (you built your own — these bloat the bundle)
- [ ] Add empty-catch logging in socket handlers — dozens of `} catch {}` blocks silently swallow errors making debugging hard
- [ ] Match socket.io versions: backend is `4.6.1`, mobile client is `4.7.2` — update backend to `4.7.x`
- [ ] Add error tracking (Sentry has a free tier and an Expo SDK): `expo install @sentry/react-native`

---

## QUICK REFERENCE — What's Done vs Not Done

| Feature | Backend | Mobile | Verdict |
|---|---|---|---|
| Phone OTP Auth | ✅ | ✅ | Done (enable Twilio for prod) |
| Live Audio Rooms | ✅ | ✅ | Done (fix uid bug first) |
| Swipe / Match | ✅ | ✅ | Done |
| Direct Messages | ✅ | ✅ | Done |
| Feed / Posts | ✅ | ⚠️ no create screen | Almost done |
| Gifting System | ✅ | ✅ | Done (fix host cut bug) |
| Spota Coins | ✅ | ⚠️ demo only | Needs real IAP |
| Voltage / Ranks | ✅ | ✅ | Done |
| Notifications | ⚠️ no send | ❌ no screen | Needs work |
| Push Notifications | ❌ | ❌ | Not built |
| Stories | ⚠️ DB only | ❌ | Not built |
| Admin Panel | ✅ | N/A | Done |
| Avatar Upload | ❌ | ❌ | Not built (Picsum fallback) |

---

## MINIMUM VIABLE LAUNCH ORDER

If you want to get into the Play Store as fast as possible, do this in order:

1. Fix the Agora uid bug (Section 1.1)
2. Fix the gift host cut bug (Section 1.2)
3. Enable Twilio SMS (Section 1.3)
4. Create NotificationsScreen stub (Section 2.1)
5. Create CreatePostScreen stub (Section 2.2)
6. Fill in all env vars (Section 3)
7. Set up RevenueCat for real Spota purchases (Section 1.4)
8. Deploy backend, verify /health (Section 6)
9. Build production APK/AAB via EAS (Section 5.3)
10. Submit to Play Store internal testing (Section 5.3)
