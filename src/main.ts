import { Client, Collection, GatewayIntentBits, REST, Routes } from "discord.js";
import config from "./config/config.js";
import { getPrismaClient, disconnectPrisma } from "./database/client.js";
import { setDiscordClient, logger } from "./utils/logger.js";
import { startScheduledSync, stopScheduledSync } from "./utils/scheduler.js";
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
					logger.info(`Loaded command: ${command.data.name}`);
				}
			} catch (error) {
				logger.error(`Failed to load command ${file}:`, error);
			}
		}
	}
}

// Register commands with Discord
async function registerCommands(): Promise<void> {
	const rest = new REST().setToken(config.discord.token);

	const commandsData = commands.map((cmd) => cmd.data.toJSON());

	try {
		logger.info(`Registering ${commandsData.length} commands...`);

		await rest.put(
			Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
			{ body: commandsData },
		);

		logger.info("Successfully registered all commands");
	} catch (error) {
		logger.error("Error registering commands:", error);
		throw error;
	}
}

// Initialize bot
async function initialize(): Promise<void> {
	try {
		// Test database connection
		const prisma = getPrismaClient();
		await prisma.$connect();
		logger.info("Database connection established");

		// Load commands
		await loadCommands();

		// Register commands
		await registerCommands();

		// Set up Discord client
		setDiscordClient(client);

		// Start scheduled sync
		startScheduledSync(client);

		logger.info("Bot initialized successfully");
	} catch (error) {
		logger.error("Error initializing bot:", error);
		process.exit(1);
	}
}

// Handle interactions
client.on("interactionCreate", async (interaction) => {
	if (!interaction.isChatInputCommand()) {
		return;
	}

	const command = commands.get(interaction.commandName);

	if (!command) {
		logger.warn(`Unknown command: ${interaction.commandName}`);
		return;
	}

	try {
		await command.execute(interaction);
	} catch (error) {
		logger.error(`Error executing command ${interaction.commandName}:`, error);

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
	logger.info(`Bot is ready! Logged in as ${client.user?.tag}`);
});

// Handle errors
client.on("error", (error) => {
	logger.error("Discord client error:", error);
});

process.on("unhandledRejection", (error) => {
	logger.error("Unhandled promise rejection:", error);
});

process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception:", error);
	process.exit(1);
});

// Graceful shutdown
async function shutdown(): Promise<void> {
	logger.info("Shutting down bot...");

	stopScheduledSync();
	const { cleanupScheduledDeletions } = await import("./utils/dmManager.js");
	cleanupScheduledDeletions();
	await disconnectPrisma();
	client.destroy();

	logger.info("Bot shut down complete");
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Start bot
client.login(config.discord.token).then(() => {
	initialize().catch((error) => {
		logger.error("Failed to initialize bot:", error);
		process.exit(1);
	});
});

