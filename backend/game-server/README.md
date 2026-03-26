# Office Fun Game Server

## Setup

1. **Install dependencies**
   ```bash
   cd backend/game-server
   npm install
   ```

2. **Configure SMS (optional for local testing)**  
   Create a `.env` file:
   ```env
   PORT=3000
   SMS_PROVIDER=mock        # Use 'mock' for local testing, 'twilio' or 'msg91' for real SMS
   ADMIN_TOKEN=office-fun-admin

   # Twilio (if using Twilio)
   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxx
   TWILIO_AUTH_TOKEN=xxxxxxxxxxxxxxxx
   TWILIO_PHONE=+1234567890

   # MSG91 (if using MSG91)
   MSG91_AUTH_KEY=xxxxxxxxxxxxxxxx
   ```

3. **Start the server**
   ```bash
   npm start
   # or for dev with auto-reload:
   npx nodemon server.js
   ```

4. **Expose locally via ngrok (for SMS webhooks)**
   ```bash
   npx ngrok http 3000
   ```
   Copy the `https://xxx.ngrok.io` URL and set it in your SMS provider's webhook:
   - **Twilio**: Phone Numbers → Your Number → Messaging → Webhook = `https://xxx.ngrok.io/api/sms/webhook`
   - **MSG91**: Flow → Incoming → Webhook = `https://xxx.ngrok.io/api/sms/msg91`

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/health` | Server health check |
| GET | `/api/game/state` | Current game state |
| POST | `/api/game/control` | `{ action: "start"\|"next"\|"pause"\|"resume"\|"reset" }` |
| POST | `/api/game/upload-config` | Upload Excel config (multipart) |
| GET | `/api/game/template` | Download Excel template |
| GET | `/api/game/export-scores` | Download leaderboard Excel |
| POST | `/api/sms/mock` | Simulate SMS `{ phone, message }` |
| POST | `/api/sms/webhook` | Twilio webhook receiver |
| POST | `/api/sms/msg91` | MSG91 webhook receiver |

## Excel Template Structure

**Questions sheet columns:**
- `No`, `ContentURL`, `ContentType` (image/gif/video/youtube/url), `Answer`, `Timer(s)`, `Points`, `BreakAfterWin(s)`, `Hint`

**Phonebook sheet columns:**
- `Phone` (with country code e.g. +91...), `PlayerName`
