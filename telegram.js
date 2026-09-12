/**
 * ꜱᴀꜱᴜᴋᴇX — Telegram Bridge
 * Lets you control WhatsApp connection from Telegram.
 */

const TelegramBot = require('node-telegram-bot-api');
const settings = require('./settings');

let bot = null;
let onConnectRequest = null;

function isOwner(msg) {
  if (!settings.telegramOwnerId) return true;
  return String(msg.chat.id) === String(settings.telegramOwnerId);
}

function init(connectHandler) {
  if (!settings.telegramToken || settings.telegramToken.includes('YOUR_')) {
    console.log('[TG] No Telegram token set — Telegram bridge disabled.');
    return null;
  }

  onConnectRequest = connectHandler;
  bot = new TelegramBot(settings.telegramToken, { polling: true });

  console.log('[TG] ✅ Telegram bot polling started.');

  bot.onText(/^\/start$/, (msg) => {
    if (!isOwner(msg)) return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');
    bot.sendMessage(msg.chat.id,
      `🤖 *ꜱᴀꜱᴜᴋᴇX Bridge*\n\n` +
      `*Commands:*\n` +
      `▸ /connect <number> — Link WhatsApp\n` +
      `▸ /status — Check connection\n` +
      `▸ /help — Show this menu`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/^\/help$/, (msg) => {
    if (!isOwner(msg)) return;
    bot.sendMessage(msg.chat.id,
      `📖 *Help*\n\n` +
      `▸ \`/connect 917052500819\` — Start pairing\n` +
      `▸ \`/status\` — Show WhatsApp state\n\n` +
      `_Pairing code will appear here._`,
      { parse_mode: 'Markdown' }
    );
  });

  bot.onText(/^\/connect(?:\s+(.+))?$/, async (msg, match) => {
    if (!isOwner(msg)) return bot.sendMessage(msg.chat.id, '⛔ Unauthorized.');

    const number = (match[1] || settings.ownerNumber || '').replace(/\D/g, '');
    if (!number) {
      return bot.sendMessage(msg.chat.id, '❌ Usage: `/connect 917052500819`', { parse_mode: 'Markdown' });
    }

    await bot.sendMessage(msg.chat.id,
      `🔗 *Starting WhatsApp pairing...*\nNumber: \`+${number}\`\n\n_Waiting for pairing code from WhatsApp..._`,
      { parse_mode: 'Markdown' }
    );

    if (onConnectRequest) {
      try { await onConnectRequest(number); }
      catch (e) { bot.sendMessage(msg.chat.id, `❌ Connect failed: ${e.message}`); }
    }
  });

  bot.onText(/^\/status$/, (msg) => {
    if (!isOwner(msg)) return;
    const status = global.__waStatus || 'unknown';
    bot.sendMessage(msg.chat.id, `📊 WhatsApp: *${status}*`, { parse_mode: 'Markdown' });
  });

  bot.on('polling_error', (err) => {
    console.error('[TG] polling error:', err.message);
  });

  return bot;
}

function send(text, opts = {}) {
  if (!bot || !settings.telegramOwnerId) return;
  bot.sendMessage(settings.telegramOwnerId, text, { parse_mode: 'Markdown', ...opts })
    .catch(() => {});
}

module.exports = { init, send };