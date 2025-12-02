import { Client } from "discord.js";
import { getPrismaClient } from "../database/client.js";
import { evaluateUserRoles } from "../roles/evaluateRoles.js";
import { applyRoleChanges } from "./roleManager.js";
import { logger } from "./logger.js";
import config from "../config/config.js";
import { checkForNewContent, reEvaluateAllUsersOnNewContent } from "./contentChecker.js";

let syncInterval: NodeJS.Timeout | null = null;
let dailyContentCheckInterval: NodeJS.Timeout | null = null;

export function startScheduledSync(client: Client): void {
	if (syncInterval) {
		clearInterval(syncInterval);
	}

	const intervalMs = config.sync.interval * 60 * 1000; // Convert minutes to milliseconds

	logger.info(`🐵 Starting scheduled monkey sync (interval: ${config.sync.interval} minutes)`, false);

	// Scheduled syncs should be silent (no Discord logs) - only log errors
	syncInterval = setInterval(async () => {
		await runSync(client, true);
	}, intervalMs);

	// Run initial sync after a short delay (silent - no Discord log channel messages)
	setTimeout(() => runSync(client, true), 5000);

	// Start daily content check (runs once per day)
	startDailyContentCheck(client);
}

export function stopScheduledSync(): void {
	if (syncInterval) {
		clearInterval(syncInterval);
		syncInterval = null;
		logger.info("🐵 Stopped scheduled monkey sync", false);
	}
	if (dailyContentCheckInterval) {
		clearInterval(dailyContentCheckInterval);
		dailyContentCheckInterval = null;
		logger.info("🐵 Stopped daily content check", false);
	}
}

function startDailyContentCheck(client: Client): void {
	if (dailyContentCheckInterval) {
		clearInterval(dailyContentCheckInterval);
	}

	// Run once per day (24 hours = 24 * 60 * 60 * 1000 ms)
	const dailyIntervalMs = 24 * 60 * 60 * 1000;

	logger.info("🐵 Starting daily content check (runs once per day)", false);

	// Run initial check after a short delay
	setTimeout(async () => {
		await runDailyContentCheck(client);
	}, 10000); // 10 seconds after bot starts

	// Then run every 24 hours
	dailyContentCheckInterval = setInterval(async () => {
		await runDailyContentCheck(client);
	}, dailyIntervalMs);
}

async function runDailyContentCheck(client: Client): Promise<void> {
	try {
		logger.info("🐵 Running daily content check...", false);
		const hasNewContent = await checkForNewContent();
		
		if (hasNewContent) {
			logger.info("🐵 New content detected! Re-evaluating all users...", false);
			await reEvaluateAllUsersOnNewContent(client);
		}
	} catch (error) {
		logger.error("🐵 Error in daily content check - the monkeys are confused!", false, error);
	}
}

async function runSync(client: Client, silent = false): Promise<void> {
	const prisma = getPrismaClient();
	const guild = await client.guilds.fetch(config.discord.guildId);

	if (!guild) {
		logger.error("🐵 Guild not found for scheduled monkey sync - even the monkeys are confused!", false);
		return;
	}

	if (!silent) {
		logger.info("🐵 Starting scheduled monkey role sync...", false);
	}

	try {
		// Get all users with linked OAKs
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

				await applyRoleChanges(guild, user.discord_id, roleDiff, false, silent);

				if (!silent && (roleDiff.rolesToAdd.length > 0 || roleDiff.rolesToRemove.length > 0)) {
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
					
					// Only log to Discord if not silent (initial sync on restart should be silent)
					logger.info(
						`Sync: Updated roles for ${username} - Added: ${addedText}, Removed: ${removedText}`,
						silent
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
				logger.error(`🐵 Error syncing roles for user ${username} - the monkeys are having trouble!`, false, error);
				// Continue with next user even if one fails
			}
		}

		// Only log completion if there were errors (even in silent mode, errors should be logged)
		if (errors > 0) {
			logger.warn(`🐵 Scheduled monkey sync complete with ${errors} error(s): ${processed} users processed`, false);
		}
	} catch (error) {
		logger.error("🐵 Error in scheduled monkey sync - the monkeys are confused!", false, error);
	}
}

