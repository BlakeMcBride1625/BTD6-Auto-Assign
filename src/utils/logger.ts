import { Client, TextChannel, User, EmbedBuilder } from "discord.js";
import config from "../config/config.js";
import { EmbedColor } from "./embeds.js";

let discordClient: Client | null = null;

export function setDiscordClient(client: Client): void {
	discordClient = client;
}

async function logEmbedToDiscord(embed: EmbedBuilder): Promise<void> {
	if (!discordClient) {
		console.warn("Discord client not set, cannot log embed");
		return;
	}

	try {
		const channel = await discordClient.channels.fetch(config.discord.channels.logs);
		if (channel && channel instanceof TextChannel) {
			await channel.send({ embeds: [embed] });
		} else {
			console.warn("Log channel not found or not a text channel");
		}
	} catch (error) {
		console.error("Failed to log embed to Discord:", error);
	}
}

export function log(level: "info" | "warn" | "error", message: string, silent = false, ...args: unknown[]): void {
	const timestamp = new Date().toISOString();
	const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}`;

	console[level === "error" ? "error" : level === "warn" ? "warn" : "log"](logMessage, ...args);

	// Skip Discord logging if silent flag is set
	if (silent) {
		return;
	}

	// Log errors, warnings, and info messages to Discord (unless silent)
	if (
		!silent &&
		(
			level === "error" ||
			level === "warn" ||
			(level === "info" && (
				message.includes("Staff command") ||
				message.includes("Command blocked:") ||
				message.includes("Sync:") ||
				message.includes("Account linked:") ||
				message.includes("Account unlinked:")
			))
		)
	) {
		// Create embedded logs for all messages
		const embed = new EmbedBuilder()
			.setTimestamp()
			.setColor(
				level === "error" ? EmbedColor.Error :
				level === "warn" ? EmbedColor.Warning :
				EmbedColor.Info
			);

		// For sync messages, create embedded log
		if (level === "info" && message.includes("Sync:")) {
			const parts = message.match(/Sync: Updated roles for (.+?) - Added: (.+?), Removed: (.+)/);
			if (parts) {
				const [, username, addedRoles, removedRoles] = parts;
				embed
					.setTitle("🔄 Monkey Role Sync Update")
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
			} else {
				// Fallback for other sync messages
				embed
					.setTitle("🔄 Role Sync")
					.setDescription(message.replace("Sync: ", ""));
			}
		} else if (level === "info" && message.includes("Command blocked:")) {
			// Parse command blocked messages
			// Pattern: "🐵 Command blocked: username tried to use /commandname but has <@&roleId>"
			const blockedMatch = message.match(/Command blocked: (.+?) tried to use \/(\w+) but has (.+)$/);
			if (blockedMatch) {
				const [, username, command, roleMention] = blockedMatch;
				embed
					.setTitle("🚫 Command Blocked")
					.addFields(
						{
							name: "User",
							value: username,
							inline: true,
						},
						{
							name: "Command",
							value: `/${command}`,
							inline: true,
						},
						{
							name: "Blocked By Role",
							value: roleMention,
							inline: false,
						},
					);
			} else {
				// Fallback for command blocked messages that don't match pattern
				const cleanMessage = message.replace(/^🐵\s*/, "");
				embed
					.setTitle("🚫 Command Blocked")
					.setDescription(cleanMessage);
			}
		} else if (level === "info" && message.includes("Staff command")) {
			// Parse staff command messages
			// Pattern: "🐵 Staff command /commandname used by username on targetuser" or "🐵 Staff command /commandname used by username: details"
			const staffCommandMatch = message.match(/Staff command \/(\w+) used by (.+?)(?: on (.+?))?(?:: (.+))?$/);
			if (staffCommandMatch) {
				const [, command, staffUser, targetUser, details] = staffCommandMatch;
				embed
					.setTitle(`🛡️ Staff Command: /${command}`)
					.addFields(
						{
							name: "Staff Member",
							value: staffUser,
							inline: true,
						},
					);
				if (targetUser) {
					embed.addFields({
						name: "Target User",
						value: targetUser,
						inline: true,
					});
				}
				if (details) {
					embed.addFields({
						name: "Details",
						value: details,
						inline: false,
					});
				}
			} else {
				// Fallback for staff command messages that don't match pattern
				// Remove emoji prefix if present
				const cleanMessage = message.replace(/^🐵\s*/, "");
				embed
					.setTitle("🛡️ Staff Command")
					.setDescription(cleanMessage);
			}
		} else if (level === "info" && (message.includes("Account linked:") || message.includes("Account unlinked:"))) {
			// These are handled by logAccountLinked/logAccountUnlinked, but fallback here
			embed
				.setTitle(message.includes("Account linked:") ? "🔗 Account Linked" : "🔓 Account Unlinked")
				.setDescription(message);
		} else {
			// For all other messages (errors, warnings, general info)
			embed
				.setTitle(`${level === "error" ? "❌" : level === "warn" ? "⚠️" : "ℹ️"} ${level.toUpperCase()}`)
				.setDescription(message);
		}

		logEmbedToDiscord(embed).catch(() => {
			// Ignore errors in logging
		});
	}
}

export const logger = {
	info: (message: string, silent = false, ...args: unknown[]) => log("info", message, silent, ...args),
	warn: (message: string, silent = false, ...args: unknown[]) => log("warn", message, silent, ...args),
	error: (message: string, silent = false, ...args: unknown[]) => log("error", message, silent, ...args),
	logAccountLinked: (user: User, displayName: string, roleMentions: string[]) => {
		const embed = new EmbedBuilder()
			.setTitle("🐵 Monkey Business Alert! A new OAK has been linked!")
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
			.setTitle("😢 OAK unlinked - the monkeys are sad!")
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

