require('dotenv').config();
const path = require('path');
const pino = require('pino');
const TelegramBot = require('node-telegram-bot-api');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');

const TG_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const OWNER_ID = String(process.env.TELEGRAM_OWNER_ID || '');
const SESSION_DIR = path.join(__dirname, 'session');

if (!TG_TOKEN || !OWNER_ID) {
  console.error('Missing TELEGRAM_BOT_TOKEN or TELEGRAM_OWNER_ID in .env');
  process.exit(1);
}

const tg = new TelegramBot(TG_TOKEN, { polling: true });

let sock = null;
let pairingRequestedFor = null; // phone number currently being paired
let waConnected = false;
let waJid = null;

function isOwner(msg) {
  return String(msg.from.id) === OWNER_ID;
}

function send(chatId, text) {
  tg.sendMessage(chatId, text).catch((e) => console.error('TG send error:', e.message));
}

async function startWhatsApp(phoneNumberForPairing) {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: ['WA-TG-Bot', 'Chrome', '1.0.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  // Request pairing code if not already registered and a number was given
  if (!sock.authState.creds.registered && phoneNumberForPairing) {
    try {
      const code = await sock.requestPairingCode(phoneNumberForPairing.replace(/[^0-9]/g, ''));
      send(OWNER_ID, `🔗 Pairing code for ${phoneNumberForPairing}:\n\n${code}\n\nOpen WhatsApp → Settings → Linked Devices → Link a Device → Link with phone number instead → enter this code.`);
    } catch (err) {
      send(OWNER_ID, `❌ Failed to get pairing code: ${err.message}`);
    }
  }

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === 'open') {
      waConnected = true;
      waJid = sock.user?.id || null;
      send(OWNER_ID, `✅ WhatsApp connected as ${waJid}`);
    }

    if (connection === 'close') {
      waConnected = false;
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;

      send(OWNER_ID, `⚠️ WhatsApp disconnected (code: ${statusCode}). ${loggedOut ? 'Logged out — use /connect <number> to pair again.' : 'Reconnecting...'}`);

      if (!loggedOut) {
        // auto-reconnect for normal drops
        startWhatsApp();
      }
    }
  });
}

// ---- Telegram command handlers ----

tg.onText(/^\/start$/, (msg) => {
  if (!isOwner(msg)) return;
  send(msg.chat.id,
    `🤖 WA-TG Bot ready.\n\nCommands:\n/connect <number> - pair WhatsApp (e.g. /connect 91XXXXXXXXXX)\n/status - check connection\n/ping - test bot\n/send <number> <message> - send WhatsApp message`);
});

tg.onText(/^\/ping$/, (msg) => {
  if (!isOwner(msg)) return;
  send(msg.chat.id, 'pong 🏓');
});

tg.onText(/^\/status$/, (msg) => {
  if (!isOwner(msg)) return;
  send(msg.chat.id, waConnected ? `✅ Connected as ${waJid}` : '❌ Not connected. Use /connect <number>.');
});

tg.onText(/^\/connect (.+)$/, async (msg, match) => {
  if (!isOwner(msg)) return;
  const number = match[1].trim();
  if (waConnected) {
    return send(msg.chat.id, 'Already connected. Restart the bot if you want to re-pair a different number.');
  }
  send(msg.chat.id, `⏳ Requesting pairing code for ${number}...`);
  pairingRequestedFor = number;
  try {
    await startWhatsApp(number);
  } catch (err) {
    send(msg.chat.id, `❌ Error starting WhatsApp: ${err.message}`);
  }
});

tg.onText(/^\/send (\d+) (.+)$/s, async (msg, match) => {
  if (!isOwner(msg)) return;
  if (!waConnected || !sock) {
    return send(msg.chat.id, '❌ WhatsApp not connected. Use /connect <number> first.');
  }
  const number = match[1];
  const text = match[2];
  const jid = `${number}@s.whatsapp.net`;
  try {
    await sock.sendMessage(jid, { text });
    send(msg.chat.id, `✅ Sent to ${number}`);
  } catch (err) {
    send(msg.chat.id, `❌ Failed to send: ${err.message}`);
  }
});

console.log('Telegram bot polling started. Send /start to your bot on Telegram.');
