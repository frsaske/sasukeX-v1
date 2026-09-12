 # WA-TG Bot

WhatsApp bot (Baileys) that connects via pairing code and is controlled entirely through your own Telegram bot.

## Setup

1. **Install dependencies**
   ```
   npm install
   ```

2. **Create a Telegram bot**
   - Message [@BotFather](https://t.me/BotFather) on Telegram → `/newbot` → follow steps → copy the token.

3. **Get your Telegram user ID**
   - Message [@userinfobot](https://t.me/userinfobot) → it replies with your numeric ID.

4. **Configure `.env`**
   ```
   cp .env.example .env
   ```
   Fill in:
   ```
   TELEGRAM_BOT_TOKEN=123456:ABC-your-token
   TELEGRAM_OWNER_ID=123456789
   ```

5. **Run it**
   ```
   npm start
   ```

## Usage (on Telegram, message your bot)

| Command | What it does |
|---|---|
| `/start` | Shows help |
| `/connect <number>` | Requests a WhatsApp pairing code for that number (e.g. `/connect 919876543210`) |
| `/status` | Shows whether WhatsApp is connected |
| `/ping` | Health check |
| `/send <number> <message>` | Sends a WhatsApp text message |

## Pairing flow

1. On Telegram: `/connect 919876543210`
2. Bot replies with an 8-character pairing code.
3. On your phone: **WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead** → enter the code.
4. Bot sends `✅ WhatsApp connected` once linked.

Session credentials are saved in `session/` — do **not** commit or share this folder, it's equivalent to your WhatsApp login.

## Notes

- Only the Telegram user ID set as `TELEGRAM_OWNER_ID` can control the bot — everyone else's messages are ignored.
- If WhatsApp disconnects unexpectedly (not a logout), the bot auto-reconnects using the saved session.
- If actually logged out (red flag from WhatsApp), you'll need to `/connect <number>` again.
