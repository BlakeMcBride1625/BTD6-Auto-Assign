import { Client, TextChannel, User, EmbedBuilder } from "discord.js";
import config from "../config/config.js";
import { EmbedColor } from "./embeds.js";

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
	discordClient = client;
}

async function logToDiscord(message: string): Promise<void> {
	if (!discordClient) {
		return;
	}

	try {
		const channel = await discordClient.channels.fetch(config.discord.channels.logs);
		if (channel && channel instanceof TextChannel) {
			await channel.send({
				content: `\`[${new Date().toISOString()}]\` ${message}`,
			});
		}
	} catch (error) {
		console.error("Failed to log to Discord:", error);
	}
}

async function logEmbedToDiscord(embed: EmbedBuilder): Promise<void> {
	if (!discordClient) {
		return;
	}

	try {
		const channel = await discordClient.channels.fetch(config.discord.channels.logs);
		if (channel && channel instanceof TextChannel) {
			await channel.send({ embeds: [embed] });
		}
	} catch (error) {
		console.error("Failed to log embed to Discord:", error);
	}
}

export function log(level: "info" | "warn" | "error", message: string, ...args: unknown[]): void {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

	console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](logMessage, ...args);

	// Log errors, warnings, and info messages to Discord
	if (
		level === "error" ||
		level === "warn" ||
		(level === "info" && (
			message.includes("Staff command") ||
			message.includes("Sync:") ||
			message.includes("Account linked:") ||
			message.includes("Account unlinked:")
		))
	) {
		// For sync messages, create embedded log
		if (level === "info" && message.includes("Sync:")) {
			const parts = message.match(/Sync: Updated roles for (.+?) - Added: (.+?), Removed: (.+)/);
			if (parts) {
				const [, username, addedRoles, removedRoles] = parts;
				const embed = new EmbedBuilder()
					.setTitle("🔄 Role Sync Update")
					.setColor(EmbedColor.Info)
					.setTimestamp()
					.addFields(
						{
							name: "User",
							value: username,
							inline: true,
						},
						{
							name: "Roles Added",
							value: addedRoles || "None",
							inline: false,
						},
						{
							name: "Roles Removed",
							value: removedRoles || "None",
							inline: false,
						},
					);
				logEmbedToDiscord(embed).catch(() => {
					// Ignore errors in logging
				});
			} else {
				// Fallback to text log for other sync messages
				logToDiscord(`**${level.toUpperCase()}**: ${message}`).catch(() => {
					// Ignore errors in logging
				});
			}
		} else {
			// For other messages, use text log
			logToDiscord(`**${level.toUpperCase()}**: ${message}`).catch(() => {
				// Ignore errors in logging
			});
		}
	}
}

export const logger = {
	info: (message: string, ...args: unknown[]) => log("info", message, ...args),
	warn: (message: string, ...args: unknown[]) => log("warn", message, ...args),
	error: (message: string, ...args: unknown[]) => log("error", message, ...args),
	logAccountLinked: (user: User, displayName: string, roleMentions: string[]) => {
		const embed = new EmbedBuilder()
			.setTitle("✅ Account Linked")
			.setColor(EmbedColor.Success)
			.setTimestamp()
			.addFields(
				{
					name: "Display Name",
					value: displayName,
					inline: true,
				},
				{
					name: "Discord User",
					value: `${user.tag} (${user.id})`,
					inline: true,
				},
			);

		if (roleMentions.length > 0) {
			embed.addFields({
				name: "Roles Given",
				value: roleMentions.join(" ") || "None",
				inline: false,
			});
		} else {
			embed.addFields({
				name: "Roles Given",
				value: "None",
				inline: false,
			});
		}

		logEmbedToDiscord(embed).catch(() => {
			// Ignore errors in logging
		});
	},
	logAccountUnlinked: (user: User, displayName: string, roleMentions: string[]) => {
		const embed = new EmbedBuilder()
			.setTitle("❌ Account Unlinked")
			.setColor(EmbedColor.Warning)
			.setTimestamp()
			.addFields(
				{
					name: "Display Name",
					value: displayName,
					inline: true,
				},
				{
					name: "Discord User",
					value: `${user.tag} (${user.id})`,
					inline: true,
				},
			);

		if (roleMentions.length > 0) {
			embed.addFields({
				name: "Roles Removed",
				value: roleMentions.join(" ") || "None",
				inline: false,
			});
		} else {
			embed.addFields({
				name: "Roles Removed",
				value: "None",
				inline: false,
			});
		}

		logEmbedToDiscord(embed).catch(() => {
			// Ignore errors in logging
		});
	},
};

