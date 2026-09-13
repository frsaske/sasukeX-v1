const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const qrcode = require('qrcode-terminal')

const PREFIX = '.'
const SESSION = process.env.SESSION_ID || ''

// Session se creds banao
if (SESSION) {
  fs.mkdirSync('./session', { recursive: true })
  try {
    const creds = JSON.parse(Buffer.from(SESSION, 'base64').toString('utf8'))
    fs.writeFileSync('./session/creds.json', JSON.stringify(creds, null, 2))
  } catch (e) {
    console.log('❌ Session invalid:', e.message)
  }
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    printQRInTerminal: !SESSION,
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect, qr }) => {
    if (qr && !SESSION) qrcode.generate(qr, { small: true })

    if (connection === 'open') {
      console.log('🎉 Bot Connected:', sock.user.id)
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      if (code !== DisconnectReason.loggedOut) {
        console.log('🔄 Reconnecting...')
        setTimeout(start, 3000)
      } else {
        console.log('❌ Logged out')
      }
    }
  })

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return
    const msg = messages[0]
    if (!msg.message || msg.key.fromMe) return

    const from = msg.key.remoteJid
    let m = msg.message
    if (m.ephemeralMessage) m = m.ephemeralMessage.message
    if (m.viewOnceMessageV2) m = m.viewOnceMessageV2.message

    const text =
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      ''

    if (!text.startsWith(PREFIX)) return

    const args = text.slice(PREFIX.length).trim().split(/ +/)
    const cmd = args.shift().toLowerCase()
    const isGroup = from.endsWith('@g.us')
    const sender = isGroup ? msg.key.participant : from

    // ===== COMMANDS =====

    if (cmd === 'ping') {
      const t = Date.now()
      await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg })
      await sock.sendMessage(from, { text: `⚡ ${Date.now() - t}ms` }, { quoted: msg })
    }

    if (cmd === 'alive') {
      await sock.sendMessage(from, {
        text: `🤖 *Bot Active*\n\n👤 Owner: Frsaske\n📌 Prefix: ${PREFIX}\n⏰ ${new Date().toLocaleString()}`
      }, { quoted: msg })
    }

    if (cmd === 'menu' || cmd === 'help') {
      const menu = `╭━━━〔 *FRSASKE BOT* 〕━━━
┃ 📌 Prefix: ${PREFIX}
┃ 📦 Commands: 4
╰━━━━━━━━━━━━━━━━━

┌─〔 *GENERAL* 〕
│ ▸ .ping
│ ▸ .alive
│ ▸ .menu
│ ▸ .id
└────────────`
      await sock.sendMessage(from, { text: menu }, { quoted: msg })
    }

    if (cmd === 'id') {
      if (!isGroup) return sock.sendMessage(from, { text: '❌ Sirf group me kaam karega' }, { quoted: msg })
      await sock.sendMessage(from, {
        text: `📌 *Group ID:*\n\`${from}\``
      }, { quoted: msg })
    }
  })
}

start()