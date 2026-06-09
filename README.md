# LMK — Social Audio & Community App

A full-stack mobile-first social audio app with live rooms, swiping, feed, chat, and gifting.

## Stack
- **Mobile**: React Native (Expo)
- **Backend**: Node.js + Express + Socket.io
- **Database**: PostgreSQL + Redis
- **Audio**: Agora RTC

## Quick Start

### Backend
```bash
cd backend
cp .env.example .env          # fill in your credentials
psql -U postgres -f migrations/schema.sql
npm install
npm run dev
```

### Mobile
```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

## Custom Profile Photos
Users can set their profile picture two ways:
1. **From device** — picks from the camera roll or takes a live photo
2. **Aesthetic Picks** — scrollable grid of curated random images (no account needed, powered by Picsum Photos). Tap Shuffle to refresh the grid.

The picker appears during onboarding and on the Profile / Edit Profile screens.

## Key Features
- 📞 Phone OTP auth (Twilio)
- 🎙️ Live audio rooms with mic slots (Agora)
- 🎁 Virtual gifting with coin economy
- 💘 Swipe-to-match with real-time DMs
- 📝 Feed with posts, polls, stories
- ⚡ Room boost bar
- 🔔 Push notifications (FCM)

## Deployment
- Backend → Railway / Render
- Mobile → Expo EAS Build

## Anthropic (Claude) integration
This project includes an optional Anthropic (Claude) integration exposed at POST /ai/claude. To enable it:

1. Add your Anthropic API key to the backend environment (do not commit this key):

   - Edit backend/.env and set:
     ANTHROPIC_API_KEY=your_anthropic_api_key_here
     ANTHROPIC_MODEL=claude-2  # optional

   Or copy backend/.env.example -> backend/.env and fill the values.

2. Restart the backend so dotenv picks up the new values (or stop and run npm run dev).

3. Test the endpoint locally (backend must be running):

   curl -X POST http://localhost:3000/ai/claude \
     -H "Content-Type: application/json" \
     -d '{"prompt":"Say hello from Claude"}'

The endpoint will return Anthropic's response in JSON. If ANTHROPIC_API_KEY is missing, the server returns an error explaining that the key is not set.
