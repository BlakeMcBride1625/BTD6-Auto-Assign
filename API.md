# BTD6 Auto Roles Bot - API Documentation

Developer documentation for understanding and extending the BTD6 Auto Roles Discord bot.

## Table of Contents

- [Architecture Overview](#architecture-overview)
- [Project Structure](#project-structure)
- [Core Components](#core-components)
- [Adding New Commands](#adding-new-commands)
- [Role Evaluation System](#role-evaluation-system)
- [API Integration](#api-integration)
- [Database Schema](#database-schema)
- [Error Handling](#error-handling)
- [Testing & Development](#testing--development)

## Architecture Overview

The bot is built with:
- **TypeScript** for type safety
- **Discord.js v14** for Discord API interaction
- **Prisma** for database ORM
- **Node.js 20+** runtime

### Key Design Principles

1. **Modular Structure**: Commands, utilities, and services are separated into logical modules
2. **Type Safety**: Full TypeScript coverage with strict mode enabled
3. **Error Resilience**: Never removes roles on API failures (safety first)
4. **API Key Validation**: All operations require valid API key from EpildevConnect API
5. **Privacy-Focused**: All command responses are ephemeral by default

## Project Structure

```
src/
├── commands/          # Slash command handlers
│   ├── user/         # User-facing commands (verify, unlink, myroles, etc.)
│   └── staff/        # Staff-only commands (forcelink, checkuser, etc.)
├── config/           # Configuration management
│   └── config.ts     # Centralised config from environment variables
├── database/          # Database client and Prisma schema
│   ├── client.ts     # Prisma client singleton
│   └── prisma/       # Prisma schema files
├── nk/               # Ninja Kiwi API integration
│   ├── cache.ts      # Player data caching system
│   ├── fetchPlayer.ts # API fetching logic
│   └── types.ts      # TypeScript types for NK API responses
├── roles/            # Role evaluation logic
│   ├── evaluateRoles.ts    # Main role evaluation function
│   └── requirements.ts     # Role requirement definitions
├── utils/            # Utility functions
│   ├── apiValidation.ts     # API key validation (EpildevConnect)
│   ├── contentChecker.ts   # Content limits tracking
│   ├── dmManager.ts        # DM sending with auto-delete
│   ├── embeds.ts           # Discord embed builders
│   ├── flagDetection.ts    # Detects flagged/modded accounts
│   ├── logger.ts          # Logging utility (console + Discord)
│   ├── permissions.ts     # Permission checking (owner/staff)
│   ├── roleManager.ts     # Role assignment/removal logic
│   ├── scheduler.ts        # Scheduled sync operations
│   └── validation.ts      # OAK format validation
└── main.ts           # Bot entry point and initialisation
```

## Core Components

### 1. Main Entry Point (`main.ts`)

The bot initialisation flow:

```typescript
1. Validate API key (required - bot exits if invalid)
2. Connect to database (Prisma)
3. Load commands from commands/ directory
4. Register commands with Discord
5. Set up Discord client event handlers
6. Start scheduled sync operations
7. Login to Discord
```

**Key Functions:**
- `initialize()`: Main initialisation function
- `loadCommands()`: Dynamically loads commands from `commands/` directory
- `registerCommands()`: Registers slash commands with Discord API
- `shutdown()`: Graceful shutdown handler

### 2. Command System

Commands are structured as modules with two exports:

```typescript
// commands/user/example.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";

export const data = new SlashCommandBuilder()
    .setName("example")
    .setDescription("Example command");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });
    
    // API validation check (required for all commands)
    const isApiValid = await checkApiKeyValid(config.api.key);
    if (!isApiValid) {
        await interaction.editReply({
            embeds: [createErrorEmbed("Service Unavailable", "...")],
        });
        return;
    }
    
    // Command logic here
    await interaction.editReply({ embeds: [embed] });
}
```

**Command Structure:**
- `data`: SlashCommandBuilder instance defining the command
- `execute`: Async function that handles the command interaction

**Command Loading:**
Commands are automatically discovered from:
- `src/commands/user/*.ts` - User commands
- `src/commands/staff/*.ts` - Staff commands

### 3. API Key Validation

All operations require API key validation via `checkApiKeyValid()`:

```typescript
import { checkApiKeyValid } from "../utils/apiValidation.js";
import config from "../config/config.js";

// Runtime check (non-blocking, returns boolean)
const isValid = await checkApiKeyValid(config.api.key);
if (!isValid) {
    // Handle invalid API key
    return;
}
```

**Validation Points:**
- ✅ Startup (blocks bot start if invalid)
- ✅ All command handlers
- ✅ Scheduled sync operations
- ✅ Role evaluation functions

### 4. Role Evaluation System

Role evaluation is handled in `roles/evaluateRoles.ts`:

```typescript
export async function evaluateUserRoles(
    discordId: string,
    forceRefresh = false
): Promise<RoleDiff> {
    // 1. API validation check
    // 2. Fetch all linked OAKs for user
    // 3. Get player data for all OAKs
    // 4. Check for flagged accounts
    // 5. Evaluate roles based on requirements
    // 6. Return RoleDiff (roles to add/remove)
}
```

**Role Requirements** are defined in `roles/requirements.ts`:
- `fastMonkey`: Race rank ≤ 50
- `bossSlayer`: Boss rank ≤ 3
- `expertCompletionist`: All Expert maps with black CHIMPS
- `advancedCompletionist`: ≥ 25 solo black CHIMPS medals
- `grandmaster`: Black border on all maps (solo)
- `theDartLord`: Black border on all maps (solo + co-op)
- `allAchievements`: All BTD6 achievements unlocked

### 5. Ninja Kiwi API Integration

Player data fetching is handled in `nk/fetchPlayer.ts` with caching:

```typescript
import { getPlayerData } from "../nk/cache.js";

// Fetch with caching (default: 10 minutes)
const playerData = await getPlayerData(oak, forceRefresh);
```

**Caching:**
- Default duration: 10 minutes (configurable via `CACHE_DURATION`)
- Cache key: OAK (Open Access Key)
- Force refresh: Set `forceRefresh = true` to bypass cache

### 6. Database Schema

Prisma schema is defined in `database/prisma/schema.prisma`:

```prisma
model Users {
    discord_id    String   @id
    nk_accounts   NKAccounts[]
    created_at    DateTime @default(now())
}

model NKAccounts {
    id           Int      @id @default(autoincrement())
    discord_id   String
    nk_id        String   @unique  // OAK
    display_name String?
    linked_at    DateTime @default(now())
    user         Users    @relation(fields: [discord_id], references: [discord_id])
}

model StaffUsers {
    discord_id String   @id
    added_by   String
    added_at   DateTime @default(now())
}
```

**Key Constraints:**
- OAK (`nk_id`) is unique - prevents linking to multiple Discord accounts
- Transactions used for atomic operations (prevents race conditions)

## Adding New Commands

### Step 1: Create Command File

Create a new file in `src/commands/user/` or `src/commands/staff/`:

```typescript
// src/commands/user/mynewcommand.ts
import {
    ChatInputCommandInteraction,
    SlashCommandBuilder,
} from "discord.js";
import { checkApiKeyValid } from "../../utils/apiValidation.js";
import config from "../../config/config.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";

export const data = new SlashCommandBuilder()
    .setName("mynewcommand")
    .setDescription("Description of your command")
    .addStringOption((option) =>
        option
            .setName("input")
            .setDescription("Input description")
            .setRequired(true)
    );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
    await interaction.deferReply({ ephemeral: true });

    // API validation (required)
    const isApiValid = await checkApiKeyValid(config.api.key);
    if (!isApiValid) {
        await interaction.editReply({
            embeds: [
                createErrorEmbed(
                    "Service Unavailable",
                    "The bot is currently unavailable due to API validation issues. Please contact staff.",
                ),
            ],
        });
        return;
    }

    const input = interaction.options.getString("input", true);

    try {
        // Your command logic here
        const embed = createSuccessEmbed("Success", "Command executed!");
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        console.error("Error in mynewcommand:", error);
        await interaction.editReply({
            embeds: [
                createErrorEmbed(
                    "Error",
                    "An error occurred while executing this command.",
                ),
            ],
        });
    }
}
```

### Step 2: Command Auto-Discovery

Commands are automatically loaded by `main.ts` - no registration needed! The bot scans:
- `src/commands/user/*.ts` for user commands
- `src/commands/staff/*.ts` for staff commands

### Step 3: Add Permission Checks (if needed)

For staff-only commands:

```typescript
import { hasStaffAccess } from "../../utils/permissions.js";

if (!interaction.member || !(await hasStaffAccess(interaction.member as any))) {
    await interaction.editReply({
        embeds: [createErrorEmbed("Permission Denied", "...")],
    });
    return;
}
```

For owner-only commands:

```typescript
import { isOwner } from "../../utils/permissions.js";

if (!isOwner(interaction.user.id)) {
    await interaction.editReply({
        embeds: [createErrorEmbed("Permission Denied", "...")],
    });
    return;
}
```

## Adding New Roles

### Step 1: Update Role Requirements

Edit `src/roles/requirements.ts`:

```typescript
export function evaluateAllRoles(playerData: NKPlayerResponse[]): RoleResults {
    // ... existing role checks ...
    
    // Add your new role check
    const myNewRole = checkMyNewRoleRequirement(playerData);
    
    return {
        // ... existing roles ...
        myNewRole,
    };
}

function checkMyNewRoleRequirement(playerData: NKPlayerResponse[]): boolean {
    // Your requirement logic here
    return playerData.some(data => /* condition */);
}
```

### Step 2: Update Role Mapping

Edit `src/roles/evaluateRoles.ts`:

```typescript
const roleMapping = {
    // ... existing roles ...
    myNewRole: config.discord.roles.myNewRole,
};
```

### Step 3: Add Environment Variable

Add to `.env`:
```env
ROLE_MY_NEW_ROLE=role_id_here
```

Update `src/config/config.ts`:
```typescript
roles: {
    // ... existing roles ...
    myNewRole: getEnv("ROLE_MY_NEW_ROLE"),
},
```

### Step 4: Update TypeScript Types

Update `src/roles/requirements.ts`:
```typescript
export interface RoleResults {
    // ... existing roles ...
    myNewRole: boolean;
}
```

## API Integration

### EpildevConnect API Validation

The bot validates API keys against `https://api.epildevconnect.uk`:

```typescript
// Startup validation (blocks bot start)
await validateApiKey(config.api.key);

// Runtime validation (non-blocking)
const isValid = await checkApiKeyValid(config.api.key);
```

**API Endpoint:**
```
GET https://api.epildevconnect.uk/api/btd6/validate?key={api_key}
Response: { "valid": true | false }
```

### Ninja Kiwi API

Player data is fetched from:
```
GET https://data.ninjakiwi.com/btd6/players/{oak}
```

**Response Structure:**
- Wrapped in `{ error, success, body, model, next, prev }`
- Actual player data is in `body` field
- See `src/nk/types.ts` for full TypeScript types

## Database Operations

### Using Prisma Client

```typescript
import { getPrismaClient } from "../database/client.js";

const prisma = getPrismaClient();

// Find user
const user = await prisma.users.findUnique({
    where: { discord_id: "123456789" },
    include: { nk_accounts: true },
});

// Create account
await prisma.nk_accounts.create({
    data: {
        discord_id: "123456789",
        nk_id: oak,
        display_name: "Player Name",
    },
});

// Use transactions for atomic operations
await prisma.$transaction(async (tx) => {
    // Multiple operations here
});
```

## Error Handling

### Standard Error Pattern

```typescript
try {
    // Operation
} catch (error) {
    console.error("Error description:", error);
    await interaction.editReply({
        embeds: [
            createErrorEmbed(
                "Error",
                "User-friendly error message",
            ),
        ],
    });
    logger.error("🐵 Error description - the monkeys are having trouble!", false, error);
}
```

### Logging

Use the logger utility for consistent logging:

```typescript
import { logger } from "../utils/logger.js";

logger.info("Info message", false);  // false = don't send to Discord
logger.warn("Warning message", false);
logger.error("Error message", false, error);
logger.logAccountLinked(user, displayName, roleMentions);  // Specialised logging
```

## Testing & Development

### Local Development

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run prisma:generate

# Run database migrations
npm run prisma:migrate

# Build TypeScript
npm run build

# Run bot
npm start

# Development with hot reload
npm run dev
```

### Docker Development

```bash
# Build and start
docker-compose up -d

# View logs
docker-compose logs -f bot

# Rebuild after code changes
docker-compose build bot
docker-compose up -d bot

# Stop
docker-compose down
```

### Type Checking

```bash
npm run type-check  # If available
# Or
npx tsc --noEmit
```

## Common Patterns

### Fetching Player Data

```typescript
import { getPlayerData } from "../nk/cache.js";

// With cache (default)
const playerData = await getPlayerData(oak, false);

// Force refresh (bypass cache)
const playerData = await getPlayerData(oak, true);
```

### Evaluating Roles

```typescript
import { evaluateUserRoles } from "../roles/evaluateRoles.js";

// Evaluate roles for a user
const roleDiff = await evaluateUserRoles(discordId, forceRefresh);

// roleDiff contains:
// - rolesToAdd: string[]
// - rolesToRemove: string[]
// - stats: { raceRank, bossRank, ... }
```

### Applying Role Changes

```typescript
import { applyRoleChanges } from "../utils/roleManager.js";

await applyRoleChanges(
    guild,
    discordId,
    roleDiff,
    sendDM,  // true/false
    silent   // true = don't log to Discord channel
);
```

### Checking Permissions

```typescript
import { isOwner, hasStaffAccess } from "../utils/permissions.js";

// Owner check
if (isOwner(userId)) {
    // Owner-only code
}

// Staff check (requires member object)
if (await hasStaffAccess(member)) {
    // Staff-only code
}
```

### Creating Embeds

```typescript
import {
    createSuccessEmbed,
    createErrorEmbed,
    createWarningEmbed,
    createInfoEmbed,
} from "../utils/embeds.js";

const embed = createSuccessEmbed("Title", "Description");
embed.addFields({
    name: "Field Name",
    value: "Field Value",
    inline: true,
});
```

## Environment Variables

All configuration is via environment variables (see `.env.example`):

**Required:**
- `BTD6_API_KEY` - EpildevConnect API key (required for all operations)
- `DISCORD_TOKEN` - Discord bot token
- `DISCORD_CLIENT_ID` - Bot application ID
- `DISCORD_GUILD_ID` - Server ID
- `DISCORD_OWNER_ID` - Owner user ID(s), comma-separated
- `DATABASE_URL` - PostgreSQL connection string

**Role IDs:**
- `ROLE_FAST_MONKEY`
- `ROLE_BOSS_SLAYER`
- `ROLE_EXPERT_COMPLETIONIST`
- `ROLE_ADVANCED_COMPLETIONIST`
- `ROLE_GRANDMASTER`
- `ROLE_THE_DART_LORD`
- `ROLE_ALL_ACHIEVEMENTS`

**Optional:**
- `FLAGGED_MODDED_PLAYER` - Role ID for flagged accounts
- `CHANNEL_LOGS` - Log channel ID
- `CACHE_DURATION` - Cache duration in minutes (default: 10)
- `SYNC_INTERVAL` - Sync interval in minutes (default: 15)

## Best Practices

1. **Always validate API key** in command handlers
2. **Use transactions** for multi-step database operations
3. **Handle errors gracefully** with user-friendly messages
4. **Log important events** using the logger utility
5. **Use ephemeral replies** for user privacy
6. **Check permissions** before executing staff/owner commands
7. **Validate OAK format** before API calls
8. **Use type-safe Prisma queries** instead of raw SQL
9. **Follow existing code patterns** for consistency
10. **Test locally** before deploying

## Troubleshooting

### Command Not Appearing

- Check command file is in correct directory (`user/` or `staff/`)
- Verify `data` export is a SlashCommandBuilder
- Check `execute` function is exported
- Restart bot to reload commands

### Type Errors

- Run `npm run build` to check TypeScript errors
- Ensure Prisma client is generated: `npm run prisma:generate`
- Check imports are using `.js` extension (ES modules)

### Database Errors

- Verify `DATABASE_URL` is correct
- Check database is running and accessible
- Run migrations: `npm run prisma:migrate`

### API Validation Errors

- Check `BTD6_API_KEY` is set in `.env`
- Verify key is valid: `curl "https://api.epildevconnect.uk/api/btd6/validate?key=YOUR_KEY"`
- Check network connectivity

## Contact & Support

For questions or help with development:
- **Discord**: `epildev`
- **Email**: `connectwithme@epildevconnect.uk`
- **GitHub**: [@BlakeMcBride1625](https://github.com/BlakeMcBride1625)

