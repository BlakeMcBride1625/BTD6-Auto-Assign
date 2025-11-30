# Discord Bot Permissions

## Required Permissions

The bot needs the following permissions to function properly:

### Essential Permissions

1. **Manage Roles** (`MANAGE_ROLES`)
   - Required to add/remove roles from users based on their BTD6 achievements
   - Used in: `src/utils/roleManager.ts`

2. **Send Messages** (`SEND_MESSAGES`)
   - Required to send messages in channels (ephemeral responses, log channel)
   - Used for all command responses

3. **Send Messages in Threads** (`SEND_MESSAGES_IN_THREADS`)
   - Required if you want the bot to work in threads

4. **Embed Links** (`EMBED_LINKS`)
   - Required to send rich embeds (all command responses use embeds)
   - Used in: `src/utils/embeds.ts`

5. **Read Message History** (`READ_MESSAGE_HISTORY`)
   - Required to read messages in the log channel
   - Used in: `src/utils/logger.ts`

6. **Use Slash Commands** (`USE_APPLICATION_COMMANDS`)
   - Required for all slash commands to work
   - Used for all 12 commands

### Optional but Recommended

7. **View Channels** (`VIEW_CHANNELS`)
   - Required to see channels (needed to access log channel)
   - Usually granted by default

8. **Read Messages/View Channels** (`READ_MESSAGES`)
   - Required to read messages in channels
   - Usually granted by default

## Permission Integer

The minimum required permission integer is: **268445712**

This includes:
- `MANAGE_ROLES` (268435456)
- `SEND_MESSAGES` (2048)
- `SEND_MESSAGES_IN_THREADS` (274877906944)
- `EMBED_LINKS` (16384)
- `READ_MESSAGE_HISTORY` (65536)
- `USE_APPLICATION_COMMANDS` (2147483648)
- `VIEW_CHANNELS` (1024)
- `READ_MESSAGES` (1024)

## Bot Setup Instructions

### 1. Discord Developer Portal

1. Go to https://discord.com/developers/applications
2. Select your application
3. Go to **OAuth2** → **URL Generator**
4. Select scopes:
   - ✅ `bot`
   - ✅ `applications.commands`
5. Select bot permissions:
   - ✅ Manage Roles
   - ✅ Send Messages
   - ✅ Send Messages in Threads
   - ✅ Embed Links
   - ✅ Read Message History
   - ✅ Use Slash Commands
   - ✅ View Channels
   - ✅ Read Messages
6. Copy the generated URL and open it in your browser
7. Select your server and authorize

### 2. Server Setup

**Important:** The bot's role must be positioned **ABOVE** all roles it needs to manage in the server's role hierarchy.

1. Go to your Discord server
2. Server Settings → Roles
3. Find the bot's role
4. Drag it above all roles it needs to assign/remove
5. Ensure the bot role has the permissions listed above

### 3. Channel Permissions

**Log Channel:**
- The bot needs `Send Messages` and `Embed Links` in the log channel
- Set this in: Channel Settings → Permissions → Bot Role

**General Channels:**
- The bot needs `Use Slash Commands` in any channel where users will use commands
- This is usually granted server-wide

## Permission Breakdown by Feature

| Feature | Required Permission |
|---------|-------------------|
| Add/Remove Roles | `MANAGE_ROLES` |
| Send Command Responses | `SEND_MESSAGES`, `EMBED_LINKS` |
| Send Logs | `SEND_MESSAGES`, `EMBED_LINKS` |
| Slash Commands | `USE_APPLICATION_COMMANDS` |
| Read Log Channel | `READ_MESSAGE_HISTORY`, `VIEW_CHANNELS` |
| Send DMs | No special permission (uses user.send()) |

## Troubleshooting

**Bot can't add roles:**
- Check that bot role is above the target role in hierarchy
- Verify `MANAGE_ROLES` permission is enabled
- Ensure bot role has permission to manage the specific role

**Slash commands not showing:**
- Verify `USE_APPLICATION_COMMANDS` permission
- Check that bot has `applications.commands` scope
- Wait a few minutes for commands to sync globally

**Can't send messages:**
- Check `SEND_MESSAGES` permission
- Verify channel-specific permissions
- Ensure bot isn't muted in the channel

**Embeds not showing:**
- Verify `EMBED_LINKS` permission
- Check channel-specific permissions

