// ═══════════════════════════════════════════════
// SASUKE BANNER ROTATION
// ═══════════════════════════════════════════════
const SASUKE_BANNERS = [
  'https://i.ibb.co/nspQkfV0/images-1-7.jpg',
  'https://i.ibb.co/DHyKLvC6/6755-sasuke.jpg',
  'https://i.ibb.co/6RRPrNNm/images-1-6.jpg',
  'https://i.ibb.co/4w6XfvRC/images-2-1.jpg',
  'https://i.ibb.co/GQCgB1m6/5550-sasuke-uchiha.jpg'
];

let lastBannerIndex = -1;
function getRandomSasukeBanner() {
  let idx;
  do {
    idx = Math.floor(Math.random() * SASUKE_BANNERS.length);
  } while (idx === lastBannerIndex && SASUKE_BANNERS.length > 1);
  lastBannerIndex = idx;
  return SASUKE_BANNERS[idx];
}

// ═══════════════════════════════════════════════
// COMMAND HANDLER
// ═══════════════════════════════════════════════
async function handleCommand(sock, msg, text) {
  const owner = ownerJid(sock);
  const chatId = msg.key.remoteJid;
  if (!owner) return true;
  if (await handleSong(sock, msg, text)) return true;

  const isMenu = commandMatches(text, commands.menu);
  const isHelp = commandMatches(text, commands.help);
  const isProfile = commandMatches(text, commands.profilePicture);
  const isStory = commandMatches(text, commands.story);
  const isViewOnce = commandMatches(text, commands.viewOnce);
  const isClear = commandMatches(text, commands.clear);
  const isOwner = commandMatches(text, commands.owner);
  const antiDeleteArg = parseArgCommand(text, commands.antiDelete);
  const resetDelete = commandMatches(text, commands.resetAntiDelete);

  if (!isMenu && !isHelp && !isProfile && !isStory && !isViewOnce && !isClear && !isOwner && antiDeleteArg === null && !resetDelete) return false;

  // ─── MENU ───────────────────────────────────
  if (isMenu) {
    await sock.sendMessage(owner, {
      image: { url: getRandomSasukeBanner() },
      caption: menu.getMenuText()
    });
    return true;
  }

  // ─── HELP ───────────────────────────────────
  if (isHelp) {
    await sock.sendMessage(owner, {
      image: { url: getRandomSasukeBanner() },
      caption: menu.getHelpText()
    });
    return true;
  }

  // ─── OWNER ──────────────────────────────────
  if (isOwner) {
    await sock.sendMessage(owner, {
      image: { url: getRandomSasukeBanner() },
      caption: `╔══════════════════════════╗
║       *ꜱᴀꜱᴜᴋᴇX ʙᴏᴛ*       
╚══════════════════════════╝

goddamn ts was really tough to develope 😭🙏🏻
━━━━━━━━━━━━━━━━━━━━━━

*ᴅᴇᴠᴇʟᴏᴘᴇʀ*
   Owner  ·  ${settings.ownerNumber}

*ᴄᴏɴᴛᴀᴄᴛ*
   WhatsApp  ·  +${settings.ownerNumber}

━━━━━━━━━━━━━━━━━━━━━━

_Powered by ꜱᴀꜱᴜᴋᴇX_`
    });
    return true;
  }

  // ─── RESET ANTI-DELETE ──────────────────────
  if (resetDelete) {
    if (!chatId.endsWith('@g.us')) {
      store.resetFeature('antiDelete');
      await sock.sendMessage(owner, { text: '✅ Anti-Delete group/person settings have been reset.' });
    }
    return true;
  }

  // ─── ANTI-DELETE ON/OFF ─────────────────────
  if (antiDeleteArg !== null) {
    const v = antiDeleteArg.toLowerCase();
    if (!['on', 'off'].includes(v)) {
      await sock.sendMessage(owner, { text: `⚠️ Usage: ${cmdLabel(commands.antiDelete)} <on/off>` });
      return true;
    }
    const key = store.setFeature('antiDelete', chatId, msg.key.participant || chatId, v === 'on');
    await sock.sendMessage(owner, {
      text: `🛡️ Anti-Delete is now *${v.toUpperCase()}*\nScope: *${key.startsWith('group:') ? 'This group' : 'This person/chat'}*.`
    });
    return true;
  }

  // ─── CLEAR ──────────────────────────────────
  if (isClear) {
    const result = store.clearAll();
    const s = result.session;
    const totalRemoved = result.tmp.total + s.removed;
    await sock.sendMessage(owner, {
      text: `✅️ Temp files cleared!\n\n`
        + `📊 Statistics:\n`
        + `• Media cache : ${result.tmp.total}\n`
        + `• App state sync files: ${s.appState}\n`
        + `• Pre-key files: ${s.preKeys}\n`
        + `• Sender-key files: ${s.senderKeys}\n`
        + `• Other files: ${s.other}\n`
        + `= Total files removed: ${totalRemoved}\n\n`
        + `🔐 \`creds.json\` preserved.\n\n`
        + `ᴘᴏᴡᴇʀᴇᴅ ʙʏ *ꜱᴀꜱᴜᴋᴇX*`
    });
    return true;
  }

  // ─── VIEW-ONCE ──────────────────────────────
  if (isViewOnce) {
    const quoted = getQuotedMessage(msg);
    const vo = getViewOnceContainer(quoted);
    if (!vo) {
      await sock.sendMessage(owner, { text: withFooter(`❌ ${cmdLabel(commands.viewOnce)} reply to that vid/img`) });
      return true;
    }
    const ctx = msg.message?.extendedTextMessage?.contextInfo;
    const sender = ctx?.participant || chatId;
    const success = await forwardViewOnce(sock, vo, {
      sender,
      senderName: msg.pushName || sender.split('@')[0],
      chatId,
      chatName: await resolveChatName(sock, chatId)
    });
    if (success) return true;
  }

  // ─── PROFILE PICTURE ────────────────────────
  if (isProfile) {
    const target = extractTargetJid(msg);
    if (!target) {
      await sock.sendMessage(owner, { text: withFooter(`⚠️ ${cmdLabel(commands.profilePicture)} requires a reply or mention.`) });
      return true;
    }
    try {
      const ppUrl = await sock.profilePictureUrl(target, 'image');
      await sock.sendMessage(owner, {
        image: { url: ppUrl },
        caption: withFooter(`🖼️ *Profile Picture*\n\n*User:* @${target.split('@')[0]}\n*Time:* ${fmtTime(Date.now())}`),
        mentions: [target]
      });
    } catch (_) {
      await sock.sendMessage(owner, {
        text: withFooter(`❌ Could not fetch profile picture for @${target.split('@')[0]}.`),
        mentions: [target]
      });
    }
    return true;
  }

  // ─── STORY ──────────────────────────────────
  if (isStory) {
    const target = extractTargetJid(msg);
    if (!target) {
      await sock.sendMessage(owner, { text: withFooter(`⚠️ ${cmdLabel(commands.story)} requires a reply to someone.`) });
      return true;
    }
    const status = store.getStatus(target);
    if (!status) {
      await sock.sendMessage(owner, {
        text: withFooter(`❌ No recent story captured for @${target.split('@')[0]}.`),
        mentions: [target]
      });
      return true;
    }
    try {
      const caption = withFooter(`📥 *Story Captured*\n\n*User:* @${target.split('@')[0]}\n*Time:* ${fmtTime(status.timestamp)}\n\n${status.caption || ''}`);
      if (status.mediaPath && fs.existsSync(status.mediaPath)) {
        if (status.mediaType === 'image') {
          await sock.sendMessage(owner, { image: { url: status.mediaPath }, caption, mentions: [target] });
        } else if (status.mediaType === 'video') {
          await sock.sendMessage(owner, { video: { url: status.mediaPath }, caption, mentions: [target] });
        } else {
          await sock.sendMessage(owner, { text: caption, mentions: [target] });
        }
      } else {
        await sock.sendMessage(owner, { text: caption, mentions: [target] });
      }
    } catch (_) {
      await sock.sendMessage(owner, { text: withFooter('❌ Failed to forward story.') });
    }
    return true;
  }

  return false;
}