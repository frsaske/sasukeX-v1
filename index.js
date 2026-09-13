const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')
const readline = require('readline')

const PREFIX = '.'
const PHONE = process.env.PHONE || '' // Render env me daal

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const ask = (q) => new Promise(r => rl.question(q, r))

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    printQRInTerminal: false
  })

  sock.ev.on('creds.update', saveCreds)

  // Pair code generate
  if (!sock.authState.creds.registered && PHONE) {
    setTimeout(async () => {
      try {
        const code = await sock.requestPairingCode(PHONE)
        console.log('\n🔑 PAIR CODE:', code?.match(/.{1,4}/g)?.join('-'))
        console.log('📱 WhatsApp → Linked Devices → Link with phone number → Enter code\n')
      } catch (e) {
        console.log('❌ Pair error:', e.message)
      }
    }, 3000)
  }

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('🎉 Connected:', sock.user.id)
    }
    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      console.log('❌ Closed. Code:', code)
      if (code !== DisconnectReason.loggedOut) {
        setTimeout(start, 3000)
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

    const text = m.conversation || m.extendedTextMessage?.text || ''
    if (!text.startsWith(PREFIX)) return

    const cmd = text.slice(1).trim().split(' ')[0].toLowerCase()
    const isGroup = from.endsWith('@g.us')

    if (cmd === 'ping') await sock.sendMessage(from, { text: '🏓 Pong!' }, { quoted: msg })
    if (cmd === 'menu') await sock.sendMessage(from, { text: `📌 Prefix: ${PREFIX}\n\n.ping\n.menu\n.alive\n.id` }, { quoted: msg })
    if (cmd === 'alive') await sock.sendMessage(from, { text: '🤖 Bot Active' }, { quoted: msg })
    if (cmd === 'id' && isGroup) await sock.sendMessage(from, { text: `📌 ${from}` }, { quoted: msg })
  })
}

start()