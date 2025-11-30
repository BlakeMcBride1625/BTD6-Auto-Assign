# BTD6 Auto Roles Discord Bot

A Discord bot that automatically manages roles based on Bloons TD 6 (BTD6) achievements and stats from the Ninja Kiwi API.

## Features

- **Automatic Role Management**: Roles are automatically assigned/removed based on BTD6 achievements
- **Multi-Account Support**: Link multiple Ninja Kiwi accounts to one Discord account
- **NKID Exclusivity**: Each NKID can only be linked to one Discord account
- **Caching System**: Reduces API calls with configurable cache duration
- **Scheduled Sync**: Automatically re-evaluates roles at regular intervals
- **Staff Commands**: Administrative tools for managing user accounts
- **Error Resilience**: Never removes roles on API failures

## Role Requirements

- **Fast Monkey**: Race rank ≤ 50
- **Boss Slayer**: Boss rank ≤ 3
- **Expert Completionist**: All Expert maps with black CHIMPS medal (solo)
- **Advanced Completionist**: ≥ 25 solo black CHIMPS medals (summed across all linked NKIDs)
- **Grandmaster**: Black border on all maps (solo)
- **The Dart Lord**: Black border on all maps (solo + co-op)
- **All Achievements**: All BTD6 achievements unlocked on at least one NKID

## Prerequisites

- Node.js 20+ 
- PostgreSQL 14+
- Discord Bot Token
- Discord Application with Bot scope

## Local Development Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd "BTD6 Auto Roles"
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in all required values:

```bash
cp .env.example .env
```

Required environment variables:
- `DISCORD_TOKEN`: Your Discord bot token
- `DISCORD_CLIENT_ID`: Your Discord application client ID
- `DISCORD_GUILD_ID`: Your Discord server (guild) ID
- `DISCORD_OWNER_ID`: Your Discord user ID (for owner-only commands)
- `ROLE_*`: Discord role IDs for each role type
- `CHANNEL_LOGS`: Discord channel ID for logging
- `NK_API_BASE`: Ninja Kiwi API base URL (default: https://data.ninjakiwi.com/btd6/players/)
- `DATABASE_URL`: PostgreSQL connection string
- `CACHE_DURATION`: Cache duration in minutes (default: 10)
- `SYNC_INTERVAL`: Sync interval in minutes (default: 15)

### 3. Database Setup

```bash
# Generate Prisma client
npm run prisma:generate

# Run migrations
npm run prisma:migrate
```

### 4. Build and Run

```bash
# Build TypeScript
npm run build

# Run the bot
npm start

# Or run in development mode with hot reload
npm run dev
```

## Docker Deployment

### 1. Environment Setup

Create a `.env` file with all required variables (see Local Development Setup).

### 2. Build and Run

```bash
# Build and start all services
docker-compose up -d

# View logs
docker-compose logs -f bot

# Stop services
docker-compose down
```

### 3. Database Migrations

After first startup, run migrations:

```bash
docker-compose exec bot npx prisma migrate deploy
```

## Commands

### User Commands

- `/link account:<NKID>` - Link your Ninja Kiwi account
- `/unlink account:<NKID>` - Unlink a Ninja Kiwi account
- `/myaccounts` - View all linked accounts
- `/myroles` - View your current roles and progression
- `/help` - Show help message

### Staff Commands

Requires staff access (added via `/addstaff` or Administrator/Manage Roles permission):

- `/checkuser user:<User>` - View user's linked accounts and stats
- `/forcelink user:<User> nkid:<NKID>` - Force link an account (removes from previous owner if needed)
- `/forceremove user:<User> nkid:<NKID>` - Force remove an account
- `/forcerolesync user:<User>` - Force role recalculation
- `/listall user:<User>` - List all linked accounts for a user

### Owner Commands

Requires owner access (set via `DISCORD_OWNER_ID`):

- `/addstaff user:<User>` - Add a user to staff (allows them to use staff commands)
- `/removestaff user:<User>` - Remove a user from staff

## Architecture

### Project Structure

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

### Key Components

- **Config System**: Centralized configuration with environment variable validation
- **Database**: Prisma ORM with PostgreSQL for data persistence
- **NK API Integration**: Fetches player data with caching and retry logic
- **Role Evaluation**: Pure functions for checking role requirements
- **Scheduled Sync**: Background task that re-evaluates all users periodically

## Configuration

All configuration is loaded from environment variables via `src/config/config.ts`. No hardcoded values are allowed.

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
- NKID format validation prevents injection attacks
- Database transactions ensure data consistency
- Environment variables for all sensitive data

## Troubleshooting

### Bot not responding to commands

1. Check that commands are registered: Look for "Successfully registered all commands" in logs
2. Verify bot has proper permissions in Discord server
3. Check that bot is in the correct guild (guild ID matches)

### Roles not updating

1. Check log channel for error messages
2. Verify NK API is accessible
3. Check database connection
4. Use `/forcerolesync` to manually trigger update

### Database connection errors

1. Verify `DATABASE_URL` is correct
2. Check PostgreSQL is running and accessible
3. Ensure database exists
4. Run migrations: `npm run prisma:migrate`

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

## License

MIT

