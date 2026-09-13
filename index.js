const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys')
const P = require('pino')
const fs = require('fs')

const PREFIX = '.'
const SESSION_ID = 'eyJub2lzZUtleSI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoid0lYU0l3TnBVMUpmRlN1aTJvOFB4NzdPT0I1SVcyVXZhMm1veXlnOFcyTT0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoibHNVZVpaQk5LK1dlZ1lKQnRXVlpDSU5RUHM0dkZLYnBOT3lNZkFSUEUwWT0ifX0sInBhaXJpbmdFcGhlbWVyYWxLZXlQYWlyIjp7InByaXZhdGUiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiIyQnFyQ3JnNkZOQytuajhNZXZXc1I2a2RRVlorWjFNNkVnK3F3WGRNMkVVPSJ9LCJwdWJsaWMiOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJTaWZLN3kyeDJPWHdlZS90eG5MblhTZDd3NGdKcDZ3Skl4WUYxWjBnQmlRPSJ9fSwic2lnbmVkSWRlbnRpdHlLZXkiOnsicHJpdmF0ZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IjhGTk1RZnpnemNKbHIxMUV6d0lhaWlGbEk4V0h0UE5SWUQzMkRjZE54WGs9In0sInB1YmxpYyI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkRuOWxZU0plQlpCTnI4eUZvdVp2MW42ZFFvVGlwOG45ekpUMzBPRW50VWs9In19LCJzaWduZWRQcmVLZXkiOnsia2V5UGFpciI6eyJwcml2YXRlIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiSUFLM2Y2dUx0WEFUYkZPUVJQaTUyTEp3ck5MbnFZd2NYU295WkE1c3Awcz0ifSwicHVibGljIjp7InR5cGUiOiJCdWZmZXIiLCJkYXRhIjoiellZUWp1NTE1UUJOUTRMQkRxL3lxRDBqaTNoSzFDcmNrRC9qWCswRWMwOD0ifX0sInNpZ25hdHVyZSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IjJxUHhpd3ZrdS9vc2VyVEFsc0NtNXpYbGtsZzByMFBzNWV1YU9jc3JKMkdXakpMK0Jubm9vcmZUUDg5Z3RLZ2NLYVFMQzNWdjBFUndvZTVXa1FaOERnPT0ifSwia2V5SWQiOjF9LCJyZWdpc3RyYXRpb25JZCI6NCwiYWR2U2VjcmV0S2V5IjoiWnQ4Yy9tMlczQnMrN0taT29hcUhUcExsQ2ZpZ2Jpc3BmVFVMTzFwWTVHdz0iLCJwcm9jZXNzZWRIaXN0b3J5TWVzc2FnZXMiOlt7ImtleSI6eyJyZW1vdGVKaWQiOiI5MTcwNTI1MDA4MTlAcy53aGF0c2FwcC5uZXQiLCJmcm9tTWUiOnRydWUsImlkIjoiQUNEMDM4RTFFRTVCM0MwN0U0RUUwNTE1MENFMkQ2NEMiLCJwYXJ0aWNpcGFudCI6IiIsImFkZHJlc3NpbmdNb2RlIjoicG4ifSwibWVzc2FnZVRpbWVzdGFtcCI6MTc4OTI3NzEwMH1dLCJuZXh0UHJlS2V5SWQiOjgxMywiZmlyc3RVbnVwbG9hZGVkUHJlS2V5SWQiOjgxMywiYWNjb3VudFN5bmNDb3VudGVyIjowLCJhY2NvdW50U2V0dGluZ3MiOnsidW5hcmNoaXZlQ2hhdHMiOmZhbHNlfSwicmVnaXN0ZXJlZCI6dHJ1ZSwicGFpcmluZ0NvZGUiOiJEM0xBVFk2OCIsIm1lIjp7ImlkIjoiOTE3MDUyNTAwODE5OjE1QHMud2hhdHNhcHAubmV0IiwibGlkIjoiMjQ1NzQ1NDEyMjQ3NTg2OjE1QGxpZCJ9LCJhY2NvdW50Ijp7ImRldGFpbHMiOiJDTUQ1dU1BRkVLTG5tTlVHR0FNZ0FDZ0EiLCJhY2NvdW50U2lnbmF0dXJlS2V5IjoiVjZ4eVU3RERnVEJJYSszb3VnZWNpSmhHVWtXT2ZHd1dEeUtHQ2IzMGJVYz0iLCJhY2NvdW50U2lnbmF0dXJlIjoiQUVqRmhaVTU2YXQwV2NBdHlyR3VEU1J6ZS94Ti9lUTFxNFBrenhVbGduTlUrUDRVNDFWZHlFRWc2bE82UjNDWWkzcHpxQ2tTUjVlZ0ZETUcwTDluQnc9PSIsImRldmljZVNpZ25hdHVyZSI6ImRkQnREeEh5Mmtkc3pvNi9SVUlzcEtyK3R3NHAzWWxnNkNQTW9SL0Z5NEtXMkFHeDVaWUtPK09tb3pXUWhmbDdPYjhBZTY5T1pFbjhjOWY2TWpUbENBPT0ifSwic2lnbmFsSWRlbnRpdGllcyI6W3siaWRlbnRpZmllciI6eyJuYW1lIjoiMjQ1NzQ1NDEyMjQ3NTg2OjE1QGxpZCIsImRldmljZUlkIjowfSwiaWRlbnRpZmllcktleSI6eyJ0eXBlIjoiQnVmZmVyIiwiZGF0YSI6IkJWZXNjbE93dzRFd1NHdnQ2TG9IbklpWVJsSkZqbnhzRmc4aWhnbTk5RzFIIn19XSwicGxhdGZvcm0iOiJhbmRyb2lkIiwicm91dGluZ0luZm8iOnsidHlwZSI6IkJ1ZmZlciIsImRhdGEiOiJDQVVJQWdnUyJ9LCJsYXN0QWNjb3VudFN5bmNUaW1lc3RhbXAiOjE3ODkyNzcwOTYsImxhc3RQcm9wSGFzaCI6IjFQbXlYTyIsIm15QXBwU3RhdGVLZXlJZCI6IkFBQUFBSjJiIn0='

// Session decode karke creds.json banao
try {
  fs.mkdirSync('./session', { recursive: true })
  const creds = JSON.parse(Buffer.from(SESSION_ID, 'base64').toString('utf8'))
  fs.writeFileSync('./session/creds.json', JSON.stringify(creds, null, 2))
  console.log('✅ creds.json ready')
} catch (e) {
  console.log('❌ Session decode failed:', e.message)
}

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' }),
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
    connectTimeoutMs: 60000,
    keepAliveIntervalMs: 30000
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
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

    const text = m.conversation || m.extendedTextMessage?.text || m.imageMessage?.caption || m.videoMessage?.caption || ''
    if (!text.startsWith(PREFIX)) return

    const args = text.slice(PREFIX.length).trim().split(/ +/)
    const cmd = args.shift().toLowerCase()
    const isGroup = from.endsWith('@g.us')

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
      await sock.sendMessage(from, {
        text: `╭━━━〔 *SASUKE X BOT* 〕━━━\n┃ 📌 Prefix: ${PREFIX}\n╰━━━━━━━━━━━━━━━━\n\n┌─〔 *GENERAL* 〕\n│ ▸ .ping\n│ ▸ .alive\n│ ▸ .menu\n│ ▸ .id\n└────────────`
      }, { quoted: msg })
    }

    if (cmd === 'id') {
      if (!isGroup) return sock.sendMessage(from, { text: '❌ Sirf group me kaam karega' }, { quoted: msg })
      await sock.sendMessage(from, { text: `📌 *Group ID:*\n\`${from}\`` }, { quoted: msg })
    }
  })
}

start()