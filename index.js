/**
 * ꜱᴀꜱᴜᴋᴇX - private WhatsApp automation bot
 * Direct Baileys WebSocket + Telegram full control.
 */

const fs = require('fs');
const path = require('path');
const pino = require('pino');
const readline = require('readline');
const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
  Browsers,
  delay
} = require('@whiskeysockets/baileys');
const settings = require('./settings');
const tg = require('./telegram');
const { handleIncoming, handleStatusEvent, cacheContactNames } = require('./handlers');

const SESSION_DIR = path.join(process.cwd(), 'session');
let reconnectTimer = null;
let startInProgress = false;
let stopping = false;
let ownerNotifiedThisRun = false;

// ─── Message cache ─────────────────────────────
const sentMessageCache = new Map();
const SENT_CACHE_TTL = 10 * 60 * 1000;
const SENT_CACHE_MAX = 1000;
function cacheSentMessage(message) {
  const id = message?.key?.id;
  const content = message?.message;
  if (!id || !content) return;
  sentMessageCache.set(id, { content, timestamp: Date.now() });
  while (sentMessageCache.size > SENT_CACHE_MAX) {
    sentMessageCache.delete(sentMessageCache.keys().next().value);
  }
}
function getCachedMessage(id) {
  const item = sentMessageCache.get(id);
  if (!item) return undefined;
  if (Date.now() - item.timestamp > SENT_CACHE_TTL) {
    sentMessageCache.delete(id);
    return undefined;
  }
  return item.content;
}
setInterval(() => {
  const cutoff = Date.now() - SENT_CACHE_TTL;
  for (const [id, item] of sentMessageCache) {
    if (item.timestamp < cutoff) sentMessageCache.delete(id);
  }
}, 60 * 1000).unref();

const rl = process.stdin.isTTY
  ? readline.createInterface({ input: process.stdin, output: process.stdout })
  : null;

// ─── Logging ───────────────────────────────────
function log(message) { console.log(`[SASUKEX] ${message}`); }
function warn(message) { console.warn(`[SASUKEX] ⚠️ ${message}`); }
function fail(message, error) {
  console.error(`[SASUKEX] ❌ ${message}`, error ? `\n   ${error?.stack || error?.message || error}` : '');
  tg.send(`❌ *Error:* ${message}`);
}

function question(text) {
  if (rl) return new Promise(resolve => rl.question(text, resolve));
  return Promise.resolve(settings.ownerNumber || '');
}
function cleanPhoneNumber(value) { return String(value || '').replace(/\D/g, ''); }
function formatPairingCode(code) {
  const clean = String(code || '').replace(/[^A-Za-z0-9]/g, '');
  return clean.match(/.{1,4}/g)?.join('-') || String(code || '');
}
function getOwnerJid(sock) {
  const rawId = sock?.user?.id || '';
  const number = rawId.split(':')[0].split('@')[0].replace(/\D/g, '');
  return number ? `${number}@s.whatsapp.net` : null;
}
function statusCodeOf(error) {
  return error?.output?.statusCode || error?.data?.statusCode;
}
function ensureSessionFolder() {
  if (!fs.existsSync(SESSION_DIR)) {
    fs.mkdirSync(SESSION_DIR, { recursive: true });
    log('☕ Session folder created.');
  } else {
    log(`📁 Session folder found: ${SESSION_DIR}`);
  }
}
function showSessionFiles() {
  try {
    const files = fs.readdirSync(SESSION_DIR);
    if (files.includes('creds.json')) {
      log('🔐 creds.json found — reusing existing credentials.');
    } else {
      log('🔐 creds.json not found — fresh WhatsApp login.');
    }
  } catch (e) { warn(`Could not inspect session folder: ${e.message}`); }
}
async function getCurrentWaVersion() {
  log('🌐 Fetching current WhatsApp Web version...');
  const result = await fetchLatestWaWebVersion({});
  if (!result?.version?.length) throw new Error('Could not obtain WhatsApp Web version');
  log(`🌐 WhatsApp Web version: ${result.version.join('.')}`);
  return result.version;
}

// ═══════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════
async function start(phoneOverride = null) {
  if (startInProgress || stopping) return;
  startInProgress = true;
  try {
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    log(`🚀 Starting ${settings.botName}...`);
    log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    global.__waStatus = 'starting';
    ensureSessionFolder();
    showSessionFiles();
    const version = await getCurrentWaVersion();

    log('🔑 Loading multi-file authentication state...');
    const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
    const registeredAtStartup = !!state.creds.registered;

    if (registeredAtStartup) {
      log('♻️ Existing session detected. Restoring...');
      tg.send('♻️ Existing WhatsApp session detected. Restoring...');
    } else {
      log('🆕 No authenticated session. Preparing pairing...');
    }

    let phoneNumber = cleanPhoneNumber(phoneOverride || settings.ownerNumber);
    if (!registeredAtStartup && !phoneNumber) {
      phoneNumber = cleanPhoneNumber(await question('Enter WhatsApp number: '));
    }
    if (!registeredAtStartup && !phoneNumber) throw new Error('No WhatsApp number supplied.');
    if (!registeredAtStartup) log(`📱 Pairing number: ${phoneNumber}`);

    const logger = pino({ level: process.env.BAILEYS_LOG_LEVEL || 'silent' });
    log('🔧 Creating WhatsApp socket...');
    const sock = makeWASocket({
      version,
      logger,
      printQRInTerminal: false,
      browser: Browsers.ubuntu('Chrome'),
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger)
      },
      getMessage: async key => getCachedMessage(key?.id),
      markOnlineOnConnect: false,
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      defaultQueryTimeoutMs: 60000,
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 15000,
      qrTimeout: 120000
    });
    log('📡 Socket created. Waiting for handshake...');

    const originalSendMessage = sock.sendMessage.bind(sock);
    sock.sendMessage = async (...args) => {
      const sent = await originalSendMessage(...args);
      cacheSentMessage(sent);
      return sent;
    };

    sock.ev.on('creds.update', async () => {
      try {
        await saveCreds();
        if (!state.creds.registered) log('💾 Auth state updated...');
      } catch (e) { fail('Could not save credentials.', e); }
    });

    sock.ev.on('messages.upsert', async upsert => {
      for (const message of upsert?.messages || []) {
        if (message?.key?.fromMe) cacheSentMessage(message);
      }
      try { await handleIncoming(sock, upsert); }
      catch (e) { fail('Message handler error.', e); }
    });

    sock.ev.on('contacts.upsert', contacts => {
      try { cacheContactNames(contacts); } catch (_) {}
    });
    sock.ev.on('contacts.update', contacts => {
      try { cacheContactNames(contacts); } catch (_) {}
    });
    sock.ev.on('status.update', async status => {
      try { await handleStatusEvent(sock, status); } catch (_) {}
    });

    // ═══════════════════════════════════════════
    // CONNECTION UPDATE
    // ═══════════════════════════════════════════
    let pairingRequested = false;
    let pairingInProgress = false;
    let opened = false;

    sock.ev.on('connection.update', async update => {
      const { connection, lastDisconnect, qr } = update;
      const code = statusCodeOf(lastDisconnect?.error);

      if (connection === 'connecting') {
        global.__waStatus = 'connecting';
        log('🔄 WhatsApp state: CONNECTING');
      }

      // ─── Pairing ───────────────────────────
      if (qr && !registeredAtStartup && !pairingRequested && !pairingInProgress) {
        pairingInProgress = true;
        try {
          log('📲 Pairing interface ready...');
          await delay(1500);
          if (state.creds.registered || opened || stopping) return;

          log('🔗 Requesting pairing code...');
          const rawCode = await sock.requestPairingCode(phoneNumber);
          const formatted = formatPairingCode(rawCode);
          pairingRequested = true;

          log('');
          log('╔══════════════════════════════════════╗');
          log(`║       📱 PAIRING CODE: ${formatted}       ║`);
          log('╚══════════════════════════════════════╝');

          tg.send(
            `📱 *WhatsApp Pairing Code*\n\n` +
            `\`${formatted}\`\n\n` +
            `*Steps:*\n` +
            `1️⃣ Open WhatsApp\n` +
            `2️⃣ Settings → Linked Devices\n` +
            `3️⃣ Link a Device\n` +
            `4️⃣ Tap "Link with phone number instead"\n` +
            `5️⃣ Enter the code above ⬆️\n\n` +
            `_Enter the code only once._`
          );
        } catch (e) {
          pairingRequested = false;
          const pairCode = statusCodeOf(e);
          fail(`Pairing-code request failed${pairCode ? ` (status ${pairCode})` : ''}.`, e);
          tg.send(`❌ Pairing failed${pairCode ? ` (code ${pairCode})` : ''}.\nWait before retrying.`);
          if ([400, 408, 428, 429, 515].includes(pairCode)) {
            warn('WhatsApp rejected the handshake. Do not spam.');
          }
        } finally {
          pairingInProgress = false;
        }
      }

      // ─── Open (connected) ──────────────────
      if (connection === 'open') {
        opened = true;
        pairingRequested = true;
        global.__waStatus = 'connected';

        log('');
        log('╔══════════════════════════════════════════╗');
        log(`║  ✅ ${settings.botName} CONNECTED  ║`);
        log('╚══════════════════════════════════════════╝');
        log(`👤 Linked: ${sock.user?.id || 'unknown'}`);

        tg.send(`✅ *ꜱᴀꜱᴜᴋᴇX Connected*\nLinked: \`${sock.user?.id || 'unknown'}\``);

        if (!ownerNotifiedThisRun) {
          const owner = getOwnerJid(sock);
          if (owner) {
            try {
              await sock.sendMessage(owner, {
                text: `✅ *${settings.botName} Connected*\n\nSend \`/menu\` to see commands.\n\n> ᴘᴏᴡᴇʀᴇᴅ ʙʏ *ꜱᴀꜱᴜᴋᴇX*`
              });
              ownerNotifiedThisRun = true;
            } catch (e) { warn(`Confirmation failed: ${e.message}`); }
          }
        }
      }

      // ─── Close (disconnected) ──────────────
      if (connection === 'close') {
        const reason = lastDisconnect?.error?.message || 'unknown';
        global.__waStatus = `disconnected (${code || 'no code'})`;
        fail(`WhatsApp closed (${code || 'no status'}): ${reason}`);

        if (!opened && !state.creds.registered) {
          if (code === 428) warn('Handshake closed with 428.');
          if (code === 515) warn('WhatsApp requested restart.');
          if (code === 429) warn('Rate-limited.');
        }

        if (code === DisconnectReason.loggedOut) {
          warn('Session logged out. Delete session/ to start fresh.');
          tg.send('⚠️ *Logged Out.*\nDelete `session/` and `/connect` again.');
          startInProgress = false;
          return;
        }
        if (stopping || reconnectTimer) return;

        let wait = 5000;
        if ([408, 428, 515].includes(code) && !state.creds.registered) wait = 30000;
        if (code === 429) wait = 120000;
        log(`🔁 Reconnect in ${Math.round(wait / 1000)}s...`);
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          startInProgress = false;
          start().catch(e => fail('Reconnect failed.', e));
        }, wait);
      }
    });
  } catch (err) {
    fail('Fatal startup error.', err);
    if (!stopping) {
      startInProgress = false;
      log('🔁 Retry startup in 10s...');
      setTimeout(() => start().catch(e => fail('Restart failed.', e)), 10000);
    }
    return;
  }
  startInProgress = false;
}

// ═══════════════════════════════════════════════
// SHUTDOWN
// ═══════════════════════════════════════════════
function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`🛑 ${signal} received. Shutting down...`);
  tg.send(`🛑 Bot shutting down (${signal}).`);
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (rl) rl.close();
  process.exit(0);
}
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('uncaughtException', e => fail('Uncaught exception.', e));
process.on('unhandledRejection', e => fail('Unhandled promise rejection.', e));

// ═══════════════════════════════════════════════
// BOOT — Telegram bridge first, then WhatsApp
// ═══════════════════════════════════════════════
log('🚀 Booting ꜱᴀꜱᴜᴋᴇX system...');

tg.init({
  // ─── /connect <number> ───────────────────
  onConnect: async (number) => {
    log(`📲 Telegram /connect: +${number}`);
    startInProgress = false;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    await start(number);
  },

  // ─── /logout — session delete + disconnect
  onLogout: async () => {
    log('🚪 Telegram /logout — deleting session...');
    stopping = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

    try {
      if (fs.existsSync(SESSION_DIR)) {
        fs.rmSync(SESSION_DIR, { recursive: true, force: true });
        log('🗑️ session/ deleted.');
      }
    } catch (e) { warn(`Session delete failed: ${e.message}`); }

    tg.send('🗑️ *Session deleted.* Restarting in 3s...');
    setTimeout(() => {
      stopping = false;
      startInProgress = false;
      start().catch(e => fail('Restart after logout failed.', e));
    }, 3000);
  },

  // ─── /restart ────────────────────────────
  onRestart: async () => {
    log('🔄 Telegram /restart — restarting...');
    stopping = true;
    if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }
    setTimeout(() => {
      stopping = false;
      startInProgress = false;
      ownerNotifiedThisRun = false;
      start().catch(e => fail('Restart failed.', e));
    }, 2000);
  }
});

start().catch(e => fail('Fatal startup error.', e));