/**
 * ꜱᴀꜱᴜᴋᴇX — Telegram Bridge (Full Control)
 */

const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const settings = require('./settings');

let bot = null;
let onConnectRequest = null;
let onLogoutRequest = null;
let onRestartRequest = null;

const SESSION_DIR = path.join(process.cwd(), 'session');

function isOwner(msg) {
  if (!settings.telegramOwnerId) return true;
  return String(msg.chat.id) === String(settings.telegramOwnerId);
}

function init(handlers = {}) {
  if (!settings.telegramToken || settings.telegramToken.includes('YOUR_')) {
    console.log('[TG] No Telegram token set — bridge disabled.');
    return null;
  }

  onConnectRequest = handlers.onConnect;
  onLogoutRequest = handlers.onLogout;
  onRestartRequest = handlers.onRestart;

  bot = new TelegramBot(settings.telegramToken, { polling: true });
  console.log('[TG] ✅ Telegram bot polling started.');

  // ─── /start ─────────────────────────────
  bot.onText(/^\/start$/, (msg) => {
    if (!isOwner(msg)) return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    bot.sendMessage(msg.chat.id,
      `🤖 *ꜱᴀꜱᴜᴋᴇX Control Panel*\n\n` +
      `*Connection:*\n` +
      `▸ /connect <number> — Link WhatsApp\n` +
      `▸ /status — Show state\n` +
      `▸ /logout — Delete session & disconnect\n` +
      `▸ /restart — Restart bot\n\n` +
      `*Info:*\n` +
      `▸ /help — Show all commands`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /help ──────────────────────────────
  bot.onText(/^\/help$/, (msg) => {
    if (!isOwner(msg)) return;
    bot.sendMessage(msg.chat.id,
      `📖 *ꜱᴀꜱᴜᴋᴇX Help*\n\n` +
      `▸ \`/connect 917052500819\` — Start pairing\n` +
      `▸ \`/status\` — WhatsApp connection state\n` +
      `▸ \`/logout\` — Delete session/ and disconnect\n` +
      `▸ \`/restart\` — Restart the bot process\n\n` +
      `_Pairing code appears here automatically._`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /connect ───────────────────────────
  bot.onText(/^\/connect(?:\s+(.+))?$/, async (msg, match) => {
    if (!isOwner(msg)) return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');

    const number = (match[1] || settings.ownerNumber || '').replace(/\D/g, '');
    if (!number) {
      return bot.sendMessage(msg.chat.id, '❌ Usage: `/connect 917052500819`', { parse_mode: 'Markdown' });
    }

    await bot.sendMessage(msg.chat.id,
      `🔗 *Starting WhatsApp pairing...*\nNumber: \`+${number}\`\n\n_Waiting for pairing code..._`,
      { parse_mode: 'Markdown' }
    );

    if (onConnectRequest) {
      try { await onConnectRequest(number); }
      catch (e) { bot.sendMessage(msg.chat.id, `❌ Connect failed: ${e.message}`); }
    }
  });

  // ─── /status ────────────────────────────
  bot.onText(/^\/status$/, (msg) => {
    if (!isOwner(msg)) return;
    const status = global.__waStatus || 'unknown';
    const sessionExists = fs.existsSync(path.join(SESSION_DIR, 'creds.json'));
    bot.sendMessage(msg.chat.id,
      `📊 *ꜱᴀꜱᴜᴋᴇX Status*\n\n` +
      `▸ WhatsApp: \`${status}\`\n` +
      `▸ Session: ${sessionExists ? '✅ exists' : '❌ not found'}`,
      { parse_mode: 'Markdown' }
    );
  });

  // ─── /logout ────────────────────────────
  bot.onText(/^\/logout$/, async (msg) => {
    if (!isOwner(msg)) return;

    bot.sendMessage(msg.chat.id, '⚠️ Confirm logout? Type `/logout yes`', { parse_mode: 'Markdown' });
    bot.once('message', async (confirmMsg) => {
      if (confirmMsg.text !== '/logout yes') return;
      if (!isOwner(confirmMsg)) return;

      try {
        if (onLogoutRequest) await onLogoutRequest();
        bot.sendMessage(msg.chat.id, '✅ *Session deleted & disconnected.*\nSend `/connect <number>` to pair again.', { parse_mode: 'Markdown' });
      } catch (e) {
        bot.sendMessage(msg.chat.id, `❌ Logout failed: ${e.message}`);
      }
    });
  });

  // ─── /restart ───────────────────────────
  bot.onText(/^\/restart$/, async (msg) => {
    if (!isOwner(msg)) return;
    await bot.sendMessage(msg.chat.id, '🔄 Restarting bot...');
    if (onRestartRequest) onRestartRequest();
  });

  bot.on('polling_error', (err) => console.error('[TG] polling error:', err.message));
  return bot;
}

function send(text, opts = {}) {
  if (!bot || !settings.telegramOwnerId) return;
  bot.sendMessage(settings.telegramOwnerId, text, { parse_mode: 'Markdown', ...opts }).catch(() => {});
}

module.exports = { init, send };