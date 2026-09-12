const settings = require('./settings');
const commands = require('./lib/cmd');

const label = v => Array.isArray(v) ? v[0] : v;

function getMenuText() {
  return `╔══════════════════════════════════╗
║        *${settings.botName}*             
╚══════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─〔 ɢᴇɴᴇʀᴀʟ 〕────────────────────╮
│                                  
│  ${label(commands.menu)}      ·  Display command menu
│  ${label(commands.help)}      ·  Command documentation
│  ${label(commands.owner)}     ·  Owner information
│                                  
╰──────────────────────────────────╯

╭─〔 ᴘʀᴏꜰɪʟᴇ 〕────────────────────╮
│                                  
│  ${label(commands.profilePicture)}  ·  Fetch profile picture
│                                  
╰──────────────────────────────────╯

╭─〔 ᴍᴇᴅɪᴀ 〕──────────────────────╮
│                                  
│  ${label(commands.song)}      ·  Download audio from YouTube
│  ${label(commands.clear)}     ·  Clear temporary files
│                                  
╰──────────────────────────────────╯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

╭─〔 ᴄʟᴀꜱꜱɪꜰɪᴇᴅ 〕─────────────────╮
│                                  
│  Additional commands are restricted
│  and hidden by the developer ( personal cmnds hai ).
│                                  
╰──────────────────────────────────╯

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${settings.botName}`;
}

function getHelpText() {
  return `╔══════════════════════════════════╗
║       *ᴄᴏᴍᴍᴀɴᴅ ᴅᴏᴄᴜᴍᴇɴᴛᴀᴛɪᴏɴ*       
╚══════════════════════════════════╝

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*ɢᴇɴᴇʀᴀʟ*

▸ ${label(commands.menu)}
   Display the full command menu.

▸ ${label(commands.help)}
   Show documentation for all commands.

▸ ${label(commands.owner)}
   Display owner information and contact.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*ᴘʀᴏꜰɪʟᴇ*

▸ ${label(commands.profilePicture)} <reply / @tag>
   Fetch the profile picture of any user
   in full resolution.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*ᴍᴇᴅɪᴀ*

▸ ${label(commands.song)} <song name>
   Download audio from YouTube and send
   it as a media file.

▸ ${label(commands.clear)}
   Clear temporary cached, none of ur buissness ( spelling ni aati ) 

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

*ᴄʟᴀꜱꜱɪꜰɪᴇᴅ*

▸ Additional commands are restricted and
   hidden by the developer for security
   and privacy purposes.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
              ᴘᴏᴡᴇʀᴇᴅ ʙʏ ${settings.botName}`;
}

module.exports = { getMenuText, getHelpText };