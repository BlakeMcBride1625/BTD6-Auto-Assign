/**
 * Copyright (c) 2025 Blake McBride (blakemcbride1625)
 * All Rights Reserved
 * 
 * EpildevConnect Ltd is a trademark of Blake McBride.
 * 
 * This code is proprietary and confidential. Unauthorised copying, modification,
 * distribution, or use of this software, via any medium, is strictly prohibited
 * without the express written permission of Blake McBride.
 * 
 * Contact:
 *   - GitHub: blakemcbride1625
 *   - Discord: epildev
 */

import { Client, Collection, GatewayIntentBits, REST, Routes, StringSelectMenuInteraction, GuildMember } from "discord.js";
import config from "./config/config.js";
import { getPrismaClient, disconnectPrisma } from "./database/client.js";
import { setDiscordClient, logger } from "./utils/logger.js";
import { startScheduledSync, stopScheduledSync } from "./utils/scheduler.js";
import { startEventPolling, stopEventPolling } from "./utils/eventPoller.js";
import { sendDMWithAutoDelete } from "./utils/dmManager.js";
import { createErrorEmbed } from "./utils/embeds.js";
import { validateApiKey } from "./utils/apiValidation.js";
import { clearAwardedRoles } from "./utils/roleManager.js";
import { readdirSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface Command {
	data: any;
	execute: (interaction: any) => Promise<void>;
}

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildMessages,
	],
});

const commands = new Collection<string, Command>();

// Load commands
async function loadCommands(): Promise<void> {
	const commandDirs = ["user", "staff"];

	for (const dir of commandDirs) {
		const commandPath = join(__dirname, "commands", dir);
		const commandFiles = readdirSync(commandPath).filter((file) => file.endsWith(".js"));

		for (const file of commandFiles) {
			try {
				const filePath = `./commands/${dir}/${file}`;
				const command = await import(filePath);
				if (command.data && command.execute) {
					commands.set(command.data.name, command);
					logger.info(`Loaded command: ${command.data.name}`, false);
				}
			} catch (error) {
				logger.error(`Failed to load command ${file}:`, false, error);
			}
		}
	}
}

// Register commands with Discord
async function registerCommands(): Promise<void> {
	const rest = new REST().setToken(config.discord.token);

	const commandsData = commands.map((cmd) => cmd.data.toJSON());

	try {
		logger.info(`Registering ${commandsData.length} commands...`, false);

		await rest.put(
			Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
			{ body: commandsData },
		);

		logger.info("Successfully registered all commands", false);
	} catch (error) {
		logger.error("Error registering commands:", false, error);
		throw error;
	}
}

// Initialize bot
async function initialize(): Promise<void> {
	try {
		// Validate API key first - bot won't work without it
		logger.info("Validating API key...", false);
		await validateApiKey(config.api.key);
		
		// Test database connection
		const prisma = getPrismaClient();
		await prisma.$connect();
		logger.info("Database connection established", false);

		// Load commands
		await loadCommands();

		// Register commands
		await registerCommands();

		// Set up Discord client
		setDiscordClient(client);

		// Start scheduled sync
		startScheduledSync(client);

		// Start event polling
		startEventPolling(client);

		logger.info("Bot initialized successfully", false);
	} catch (error) {
		logger.error("Error initializing bot:", false, error);
		process.exit(1);
	}
}

// Handle interactions
client.on("interactionCreate", async (interaction) => {
	// Handle select menu interactions (for register-events dropdown)
	if (interaction.isStringSelectMenu()) {
		const selectInteraction = interaction as StringSelectMenuInteraction;
		
		// Check if this is a register-events select menu
		if (selectInteraction.customId.startsWith("register-events-")) {
			try {
				// Extract target user ID from custom ID
				const targetUserId = selectInteraction.customId.replace("register-events-", "");
				const eventType = selectInteraction.values[0];
				
				// Import and call the handler
				const registerEventsCommand = await import("./commands/staff/register-events.js");
				if (registerEventsCommand.handleSelectMenu) {
					await registerEventsCommand.handleSelectMenu(selectInteraction, targetUserId, eventType);
				}
			} catch (error) {
				logger.error("Error handling register-events select menu:", false, error);
				if (!selectInteraction.replied && !selectInteraction.deferred) {
					await selectInteraction.reply({
						content: "There was an error processing your selection!",
						ephemeral: true,
					});
				} else {
					await selectInteraction.update({
						content: "There was an error processing your selection!",
						components: [],
					});
				}
			}
		}
		return;
	}

	if (!interaction.isChatInputCommand()) {
		return;
	}

	// Check if user has flagged modded player role
	if (config.discord.flaggedModdedPlayer && interaction.guild) {
		try {
			const member = await interaction.guild.members.fetch(interaction.user.id);
			if (member.roles.cache.has(config.discord.flaggedModdedPlayer)) {
				// Get role name for better message
				let roleName = "Playing With Mods";
				let roleMention = `<@&${config.discord.flaggedModdedPlayer}>`;
				try {
					const role = await interaction.guild.roles.fetch(config.discord.flaggedModdedPlayer);
					if (role) {
						roleName = role.name;
						roleMention = `<@&${role.id}>`;
					}
				} catch {
					// Use default if fetch fails
				}
				
				// Log blocked command attempt
				logger.info(`🐵 Command blocked: ${interaction.user.tag} tried to use /${interaction.commandName} but has ${roleMention}`, false);
				
				// Send monkey-themed DM
				const embed = createErrorEmbed(
					"🐵 Command Access Denied",
					`You can't use this command because you have the role **${roleName}**. The monkeys have detected something and are keeping you away from the bananas! 🍌`,
				);
				
				embed.addFields({
					name: "Think this is wrong?",
					value: "If you believe this is incorrect, you can contact the staff via Modmail.",
					inline: false,
				});
				
				try {
					await sendDMWithAutoDelete(interaction.user, [embed]);
				} catch (dmError) {
					// If DM fails, silently continue (user might have DMs disabled)
					logger.warn(`Failed to send flagged user DM to ${interaction.user.tag}`, false);
				}
				
				// Return early without executing command or replying in channel
				return;
			}
		} catch (error) {
			// If member fetch fails, log and continue (don't block legitimate users)
			logger.warn(`Failed to fetch member for flagged role check: ${interaction.user.tag}`, false);
		}
	}

	const command = commands.get(interaction.commandName);

	if (!command) {
		logger.warn(`Unknown command: ${interaction.commandName}`, false);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		logger.error(`Error executing command ${interaction.commandName}:`, false, error);

		if (interaction.replied || interaction.deferred) {
			await interaction.followUp({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		} else {
			await interaction.reply({
				content: "There was an error while executing this command!",
				ephemeral: true,
			});
		}
	}
});

// Handle ready event
client.once("ready", () => {
	logger.info(`Bot is ready! Logged in as ${client.user?.tag}`, false);
});

// Handle guild member leave
client.on("guildMemberRemove", async (member: GuildMember) => {
	try {
		// Only process if it's the configured guild
		if (member.guild.id !== config.discord.guildId) {
			return;
		}

		const prisma = getPrismaClient();
		
		// Check if user has linked OAKs
		const nkAccounts = await prisma.nk_accounts.findMany({
			where: { discord_id: member.id },
		});

		// If user has OAKs, clean up their awarded roles from database
		// Note: We can't remove Discord roles since the member has already left
		if (nkAccounts.length > 0) {
			// Clear awarded roles from database (can't remove Discord roles since member left)
			const clearedRoleIds = await clearAwardedRoles(member.guild, member.id);
			
			if (clearedRoleIds.length > 0) {
				logger.info(
					`🐵 User ${member.user.tag} (${member.id}) left the server with ${nkAccounts.length} linked OAK(s). Cleaned up ${clearedRoleIds.length} tracked role(s) from database.`,
					false
				);
			}
		}
	} catch (error) {
		logger.error(`🐵 Error handling guild member remove for ${member.id} - the monkeys are having trouble!`, false, error);
	}
});

// Handle errors
client.on("error", (error) => {
	logger.error("Discord client error:", false, error);
});

process.on("unhandledRejection", (error) => {
	logger.error("Unhandled promise rejection:", false, error);
});

process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception:", false, error);
	process.exit(1);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
	logger.info("Shutting down bot...", false);

	stopScheduledSync();
	stopEventPolling();
	const { cleanupScheduledDeletions } = await import("./utils/dmManager.js");
	cleanupScheduledDeletions();
	await disconnectPrisma();
	client.destroy();

	logger.info("Bot shut down complete", false);
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start bot
client.login(config.discord.token).then(() => {
	initialize().catch((error) => {
		logger.error("Failed to initialize bot:", false, error);
		process.exit(1);
	});
});

