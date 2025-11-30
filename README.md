# BTD6 Auto Roles Discord Bot

A Discord bot that automatically manages roles based on Bloons TD 6 (BTD6) achievements and stats from the Ninja Kiwi API.

## Features

- **Automatic Role Management**: Roles are automatically assigned/removed based on BTD6 achievements
- **Multi-Account Support**: Link multiple Ninja Kiwi accounts (OAKs) to one Discord account
- **OAK Exclusivity**: Each Open Access Key (OAK) can only be linked to one Discord account
- **Caching System**: Reduces API calls with configurable cache duration
- **Scheduled Sync**: Automatically re-evaluates roles at regular intervals
- **Staff Commands**: Administrative tools for managing user accounts
- **Error Resilience**: Never removes roles on API failures
- **Privacy-Focused**: All command responses are ephemeral (only visible to the user)

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
- Open Access Key (OAK) from BTD6 (not your regular NKID)

### Getting Your OAK (Open Access Key)

**Important:** You need an Open Access Key (OAK), not your regular NKID!

1. Open Bloons TD 6
2. Go to **Settings** → **Open Data**
3. Generate an **Open Access Key (OAK)**
4. Use that OAK with `/link account:<OAK>`

**Note:** Your in-game NKID is different from the OAK needed for the API.

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
# Discord Configuration
DISCORD_TOKEN=your_bot_token
DISCORD_CLIENT_ID=your_client_id
DISCORD_GUILD_ID=your_guild_id
DISCORD_OWNER_ID=your_user_id

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
- `/link account:<OAK>` - Link your Ninja Kiwi account (requires OAK)
- `/unlink account:<OAK>` - Unlink a Ninja Kiwi account
- `/myaccounts` - View all your linked accounts
- `/myroles` - View your current roles and progression

### Staff Commands

Requires staff access (added via `/addstaff` or Administrator/Manage Roles permission):

- `/checkuser user:<User>` - View user's linked accounts and stats
- `/forcelink user:<User> nkid:<OAK>` - Force link an account (removes from previous owner if needed)
- `/forceremove user:<User> [nkid:<OAK>]` - Force remove an account (leave OAK empty to remove all)
- `/forcerolesync user:<User>` - Force role recalculation for a user
- `/listall user:<User>` - List all linked accounts for a user

### Owner Commands

Requires owner access (set via `DISCORD_OWNER_ID`):

- `/addstaff user:<User>` - Add a user to staff
- `/removestaff user:<User>` - Remove a user from staff

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

## Error Handling

- API failures never remove roles (safety first)
- Errors are logged to both console and Discord log channel
- Individual user failures don't crash the entire sync process
- Stale cache is used if API is unavailable

## Security

- Staff commands require Administrator or Manage Roles permission
- OAK format validation prevents injection attacks
- Database transactions ensure data consistency
- Environment variables for all sensitive data
- All command responses are ephemeral for privacy

## Troubleshooting

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

## Credits

Made by:
- **GitHub**: [@BlakeMcBride1625](https://github.com/BlakeMcBride1625)
- **Discord**: epildev

## License

MIT
