import { Client } from "discord.js";
import { getPrismaClient } from "../database/client.js";
import { evaluateUserRoles } from "../roles/evaluateRoles.js";
import { applyRoleChanges } from "./roleManager.js";
import { logger } from "./logger.js";
import config from "../config/config.js";

let syncInterval: NodeJS.Timeout | null = null;

export function startScheduledSync(client: Client): void {
	if (syncInterval) {
		clearInterval(syncInterval);
	}

	const intervalMs = config.sync.interval * 60 * 1000; // Convert minutes to milliseconds

	logger.info(`Starting scheduled sync (interval: ${config.sync.interval} minutes)`);

	syncInterval = setInterval(async () => {
		await runSync(client);
	}, intervalMs);

	// Run initial sync after a short delay
	setTimeout(() => runSync(client), 5000);
}

export function stopScheduledSync(): void {
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
		logger.info("Stopped scheduled sync");
	}
}

async function runSync(client: Client): Promise<void> {
	const prisma = getPrismaClient();
	const guild = await client.guilds.fetch(config.discord.guildId);

	if (!guild) {
		logger.error("Guild not found for scheduled sync");
		return;
	}

	logger.info("Starting scheduled role sync...");

	try {
		// Get all users with linked NKIDs
		const users = await prisma.users.findMany({
			include: {
				nk_accounts: true,
			},
		});

		let processed = 0;
		let errors = 0;

		for (const user of users) {
			if (user.nk_accounts.length === 0) {
				continue;
			}

			try {
				const roleDiff = await evaluateUserRoles(user.discord_id, false);
				
				// Get member to get username for logging
				let username = user.discord_id;
				try {
					const member = await guild.members.fetch(user.discord_id);
					username = member.user.tag;
				} catch {
					// If we can't fetch member, use ID
				}

				await applyRoleChanges(guild, user.discord_id, roleDiff);

				if (roleDiff.rolesToAdd.length > 0 || roleDiff.rolesToRemove.length > 0) {
					// Get role mentions for logging
					const roleMentionsAdded: string[] = [];
					const roleMentionsRemoved: string[] = [];
					
					for (const roleId of roleDiff.rolesToAdd) {
						roleMentionsAdded.push(`<@&${roleId}>`);
					}
					for (const roleId of roleDiff.rolesToRemove) {
						roleMentionsRemoved.push(`<@&${roleId}>`);
					}

					const addedText = roleMentionsAdded.length > 0 ? roleMentionsAdded.join(" ") : "None";
					const removedText = roleMentionsRemoved.length > 0 ? roleMentionsRemoved.join(" ") : "None";
					
					logger.info(
						`Sync: Updated roles for ${username} - Added: ${addedText}, Removed: ${removedText}`,
					);
				}

				processed++;
			} catch (error) {
				errors++;
				// Try to get username for error logging
				let username = user.discord_id;
				try {
					const member = await guild.members.fetch(user.discord_id);
					username = member.user.tag;
				} catch {
					// If we can't fetch member, use ID
				}
				logger.error(`Error syncing roles for user ${username}:`, error);
				// Continue with next user even if one fails
			}
		}

		logger.info(`Scheduled sync complete: ${processed} users processed, ${errors} errors`);
	} catch (error) {
		logger.error("Error in scheduled sync:", error);
	}
}

