# BTD6 Auto Roles Discord Bot

A Discord bot that automatically manages roles based on Bloons TD 6 (BTD6) achievements and stats from the Ninja Kiwi API.

## Features

- **Automatic Role Management**: Roles are automatically assigned/removed based on BTD6 achievements
- **Multi-Account Support**: Link multiple Ninja Kiwi accounts (OAKs) to one Discord account
- **OAK Exclusivity**: Each Open Access Key (OAK) can only be linked to one Discord account (enforced with database transactions)
- **Caching System**: Reduces API calls with configurable cache duration
- **Scheduled Sync**: Automatically re-evaluates roles at regular intervals (runs silently in background)
- **Daily Content Check**: Automatically detects new maps/achievements and re-evaluates all users
- **Content Management**: Staff can update content limits when new maps/achievements are released
- **Staff Commands**: Administrative tools for managing user accounts
- **Error Resilience**: Never removes roles on API failures
- **Privacy-Focused**: All command responses are ephemeral (only visible to the user)
- **Embedded Logging**: All bot messages in log channel are sent as rich embeds
- **BTD6-Themed**: Playful BTD6-themed error messages and logging
- **Silent Background Sync**: Scheduled syncs run silently without spamming logs
- **Leaf Flag Detection**: Automatically detects Ninja Kiwi's green leaf flag (modded/cheated accounts) and prevents role assignment

## Role Requirements

- **Fast Monkey**: Race rank ≤ 50
- **Boss Slayer**: Boss rank ≤ 3
- **Expert Completionist**: All Expert maps with black CHIMPS medal (solo)
- **Advanced Completionist**: ≥ 25 solo black CHIMPS medals (summed across all linked accounts)
- **Grandmaster**: Black border on all maps (solo)
- **The Dart Lord**: Black border on all maps (solo + co-op)
- **All Achievements**: All BTD6 achievements unlocked on at least one linked account

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use Docker)
- Discord Bot Token
- Discord Application with Bot scope
- Open Access Key (OAK) from BTD6
- **API Key from EpildevConnect API** (required - bot will not start without it)

### Getting Your OAK (Open Access Key)

**Important:** You need an Open Access Key (OAK)!

1. Open Bloons TD 6
2. Go to **Settings** → **Open Data**
3. Generate an **Open Access Key (OAK)**
4. Use that OAK with `/verify account:<OAK>`

**Note:** Your in-game account ID is different from the OAK needed for the API.

## ⚠️ Important: API Key Required

**This bot requires a valid API key from the EpildevConnect API to function. The bot will not start without a valid API key.**

### Getting Your API Key

1. **Contact EpildevConnect** via Discord (`epildev`) or email (`connectwithme@epildevconnect.uk`) to request an API key
2. **Or use the EpildevConnect API management Discord bot** (if you have access)
3. **Generate an API key** for the `btd6` project
4. **Add the key to your `.env` file** as `BTD6_API_KEY`
5. **The bot validates the key on startup** - if invalid or missing, the bot will exit immediately

### API Key Validation

The bot performs API key validation on startup:
- ✅ **Valid key**: Bot starts normally
- ❌ **Missing key**: Bot exits with error message
- ❌ **Invalid key**: Bot exits with error message
- ❌ **API unreachable**: Bot exits after timeout (10 seconds)

**The bot will not function without a valid API key.** This is a security requirement to ensure only authorised instances can run.

## Quick Start

### Docker Deployment (Recommended)

1. **Clone the repository:**
```bash
git clone https://github.com/BlakeMcBride1625/BTD6-Auto-Assign.git
cd BTD6-Auto-Assign
```

2. **Create `.env` file:**
```bash
cp .env.example .env
# Edit .env with your Discord bot token and other required values
```

3. **Start the bot:**
```bash
docker-compose up -d
```

4. **Initialize database:**
```bash
docker-compose exec -T bot npx prisma db push
```

5. **View logs:**
```bash
docker-compose logs -f bot
```

### Local Development

1. **Install dependencies:**
```bash
npm install
```

2. **Set up environment:**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Set up database:**
```bash
npm run prisma:generate
npm run prisma:migrate
```

4. **Build and run:**
```bash
npm run build
npm start

# Or for development with hot reload:
npm run dev
```

## Environment Variables

Required environment variables:

```env
# API Key (REQUIRED - Bot will not start without this)
BTD6_API_KEY=your_api_key_here

# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
DISCORD_OWNER_ID=your_user_id,another_user_id  # Supports multiple owner IDs (comma-separated)

# Role IDs
ROLE_FAST_MONKEY=role_id
ROLE_BOSS_SLAYER=role_id
ROLE_EXPERT_COMPLETIONIST=role_id
ROLE_ADVANCED_COMPLETIONIST=role_id
ROLE_GRANDMASTER=role_id
ROLE_THE_DART_LORD=role_id
ROLE_ALL_ACHIEVEMENTS=role_id

# Channels
CHANNEL_LOGS=channel_id

# Flagged Account Role (Optional)
FLAGGED_MODDED_PLAYER=role_id  # Role ID for accounts flagged by Ninja Kiwi (green leaf flag)

# API Configuration
NK_API_BASE=https://data.ninjakiwi.com/btd6/players/

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/btd6_roles

# Optional Settings
CACHE_DURATION=10          # Cache duration in minutes (default: 10)
SYNC_INTERVAL=15           # Sync interval in minutes (default: 15)

# Docker PostgreSQL (if using docker-compose)
POSTGRES_USER=btd6
POSTGRES_PASSWORD=changeme
POSTGRES_DB=btd6_roles
```

## Commands

### User Commands

All user commands are ephemeral (only visible to you).

- `/help` - Show help message with OAK instructions
- `/verify account:<OAK>` - Link your Ninja Kiwi account (requires OAK)
- `/unlink account:<OAK>` - Unlink a Ninja Kiwi account
- `/myaccounts` - View all your linked accounts
- `/myroles` - View your current roles and progression

### Staff Commands

Requires staff access (added via `/addstaff` or Administrator/Manage Roles permission):

- `/checkuser user:<User>` - View user's linked accounts and stats
- `/forcelink user:<User> oak:<OAK>` - Force link an account (removes from previous owner if needed)
- `/forceremove user:<User> [oak:<OAK>]` - Force remove an account (leave OAK empty to remove all)
- `/forcerolesync user:<User>` - Force role recalculation for a user
- `/listall user:<User>` - List all linked accounts for a user
- `/updatecontent [totalmaps:<number>] [totalachievements:<number>]` - Update content limits (maps/achievements) and re-evaluate all users

### Owner Commands

Requires owner access (set via `DISCORD_OWNER_ID`, supports multiple IDs comma-separated):

- `/addstaff user:<User>` - Add a user to staff
- `/removestaff user:<User>` - Remove a user from staff

**Note:** Multiple owner IDs can be set by separating them with commas in `DISCORD_OWNER_ID` (e.g., `DISCORD_OWNER_ID=123456789,987654321`)

## Bot Permissions

The bot requires the following Discord permissions:

### Essential Permissions

- **Manage Roles** - Required to add/remove roles from users
- **Send Messages** - Required for command responses
- **Embed Links** - Required for rich embeds
- **Use Slash Commands** - Required for all commands
- **Read Message History** - Required for log channel
- **View Channels** - Required to access channels

### Server Setup

1. **Invite the bot** with the required permissions
2. **Position the bot role** above all roles it needs to manage in the role hierarchy
3. **Set up log channel** - Ensure the bot can send messages in the log channel

### Permission Integer

Minimum required permission integer: **268445712**

## Project Structure

```
src/
├── commands/          # Slash command handlers
│   ├── user/         # User-facing commands
│   └── staff/        # Staff-only commands
├── config/           # Configuration management
├── database/         # Prisma schema and client
├── nk/               # Ninja Kiwi API integration
├── roles/            # Role evaluation logic
├── utils/            # Utility functions
└── main.ts           # Bot entry point
```

## Configuration

### Cache Settings

- `CACHE_DURATION`: How long to cache player data (minutes)
- Recommended: 5-15 minutes to balance freshness and API load

### Sync Settings

- `SYNC_INTERVAL`: How often to re-evaluate all users (minutes)
- Recommended: 15-30 minutes depending on server size
- Scheduled syncs run silently in the background (no Discord logs)
- Initial sync on bot restart is also silent

### Content Management

- The bot automatically tracks total maps and achievements
- When new content is released, use `/updatecontent` to update limits
- All users are automatically re-evaluated when content limits change
- Default values: 82 maps, 153 achievements (auto-detected from player data)

## Error Handling

- API failures never remove roles (safety first)
- Errors are logged to both console and Discord log channel (as embeds)
- Individual user failures don't crash the entire sync process
- Stale cache is used if API is unavailable
- BTD6-themed error messages for user-facing errors
- Database transactions prevent race conditions (OAK can't be linked to multiple accounts)

## Security

- Staff commands require Administrator or Manage Roles permission
- OAK format validation prevents injection attacks
- Database transactions ensure data consistency (prevents race conditions)
- Unique constraints prevent OAK from being linked to multiple accounts
- Environment variables for all sensitive data
- All command responses are ephemeral for privacy
- Multiple owner IDs supported for team management

## Leaf Flag Detection

The bot automatically detects when a BTD6 account has been flagged by Ninja Kiwi with the "green leaf" flag, which indicates modded or cheated gameplay.

### How It Works

- **Automatic Detection**: Checks for `cheater` or `modded` fields in the Ninja Kiwi API response
- **Immediate Action**: When a flagged account is detected:
  - The flagged role (configured via `FLAGGED_MODDED_PLAYER`) is automatically assigned
  - Normal achievement roles are **not** assigned to flagged accounts
  - User receives a DM explaining the flag status
  - Log channel receives an alert about the flagged account
- **Detection Points**: Flag detection runs:
  - When a user links an account via `/verify`
  - When staff force-links an account via `/forcelink`
  - During scheduled syncs (every 15 minutes by default)

### Configuration

Set the `FLAGGED_MODDED_PLAYER` environment variable to the Discord role ID that should be assigned to flagged accounts. If not set, the bot will still detect flags but won't assign a role.

### User Experience

When a flagged account is detected, users receive a friendly, BTD6-themed DM explaining:
- Their account has been flagged with the green leaf
- Why achievement roles cannot be assigned
- How to contact Ninja Kiwi support if they believe it's an error

The bot maintains a playful, monkey-themed tone while clearly communicating the situation.

## Logging

The bot uses embedded messages for all Discord log channel messages:

- **Staff Commands**: Logged with structured fields (Staff Member, Target User, Details)
- **Account Changes**: Logged when accounts are linked/unlinked
- **Flagged Accounts**: Logged when accounts with the green leaf flag are detected
- **Errors & Warnings**: Always logged with appropriate colours
- **Scheduled Syncs**: Run silently (no logs unless errors occur)
- **Initial Sync**: Silent on bot restart

All logs are sent as rich embeds with timestamps and appropriate colours (blue for info, yellow for warnings, red for errors).

## Troubleshooting

### Bot won't start / Exits immediately

**Most common cause: Missing or invalid API key**

1. **Check your `.env` file** - Ensure `BTD6_API_KEY` is set
2. **Verify the API key is valid** - Check logs for validation errors
3. **Test the API key manually:**
   ```bash
   curl "https://api.epildevconnect.uk/api/btd6/validate?key=YOUR_KEY_HERE"
   ```
   Should return: `{"valid": true}`
4. **Check API connectivity** - Ensure the bot can reach `https://api.epildevconnect.uk`
5. **Generate a new key** if the current one is invalid or revoked

**Error messages:**
- `BTD6_API_KEY environment variable is not set!` → Add the key to `.env`
- `Invalid API key!` → Key is revoked or incorrect
- `API validation request timed out` → Network issue or API is down

### Bot not responding to commands

1. Check that commands are registered: Look for "Successfully registered all commands" in logs
2. Verify bot has proper permissions in Discord server
3. Check that bot is in the correct guild (guild ID matches)
4. Wait a few minutes for commands to sync globally

### Roles not updating

1. Check log channel for error messages
2. Verify NK API is accessible
3. Check database connection
4. Use `/forcerolesync` to manually trigger update

### Bot can't add roles

1. Check that bot role is above the target role in hierarchy
2. Verify `MANAGE_ROLES` permission is enabled
3. Ensure bot role has permission to manage the specific role

### Database connection errors

1. Verify `DATABASE_URL` is correct
2. Check PostgreSQL is running and accessible
3. Ensure database exists
4. Run migrations: `npm run prisma:migrate` or `docker-compose exec bot npx prisma db push`

## Development

### Type Checking

```bash
npm run type-check
```

### Linting

```bash
npm run lint
```

### Database Studio

```bash
npm run prisma:studio
```

### Docker Commands

```bash
# Rebuild bot
docker-compose build bot

# Restart bot
docker-compose restart bot

# View logs
docker-compose logs -f bot

# Stop all services
docker-compose down
```

## Contact & Support

For questions, support, API key requests, or licensing inquiries, contact EpildevConnect:

- **Discord**: `epildev`
- **Email**: `connectwithme@epildevconnect.uk`
- **GitHub**: [@BlakeMcBride1625](https://github.com/BlakeMcBride1625)

## Credits

Made by:
- **GitHub**: [@BlakeMcBride1625](https://github.com/BlakeMcBride1625)
- **Discord**: epildev

## License

**Proprietary - All Rights Reserved**

This software is the exclusive property of Blake McBride. Permission is strictly required for use, modification, or distribution.

**Important:** This software requires a valid API key from the EpildevConnect API to function. See LICENSE file for full terms and conditions.

For licensing inquiries, see the [Contact & Support](#contact--support) section above.

See [LICENSE](LICENSE) file for complete license terms.
