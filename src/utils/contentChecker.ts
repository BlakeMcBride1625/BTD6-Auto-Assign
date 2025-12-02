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

import { getPrismaClient } from "../database/client.js";
import { getPlayerData } from "../nk/cache.js";
import { logger } from "./logger.js";
import { evaluateUserRoles } from "../roles/evaluateRoles.js";
import { applyRoleChanges } from "./roleManager.js";
import { Client } from "discord.js";
import config from "../config/config.js";

interface ContentBaseline {
	totalMaps: number;
	totalAchievements: number;
	lastChecked: Date;
}

// Store baseline in memory (could be moved to database if needed)
let contentBaseline: ContentBaseline | null = null;

/**
 * Check the API for current total maps and achievements count
 * NOTE: The API does NOT provide these values directly as metadata.
 * We must infer them from player data by finding maximum values.
 */
async function getCurrentContentLimits(): Promise<{ totalMaps: number; totalAchievements: number } | null> {
	// The API does not provide totalMaps/totalAchievements as metadata fields.
	// We need to infer from player data by finding maximum values.
	// This function returns null to indicate we should use the inference logic below.
	return null;
}


/**
 * Check for new content by comparing current API values with baseline
 */
export async function checkForNewContent(): Promise<boolean> {
	try {
		const prisma = getPrismaClient();
		
		// Try to get current limits from API directly first
		const apiLimits = await getCurrentContentLimits();
		
		let currentTotalMaps: number | null = null;
		let currentTotalAchievements: number | null = null;
		
		if (apiLimits) {
			// API provides values directly
			currentTotalMaps = apiLimits.totalMaps;
			currentTotalAchievements = apiLimits.totalAchievements;
		} else {
			// Need to infer from player data
			// Get all players and find the maximum CHIMPS-BLACK count (which equals total maps)
			// and maximum achievements count
			const allAccounts = await prisma.nk_accounts.findMany();
			
			let maxChimpsBlack = 0;
			let maxAchievements = 0;
			
			// Check a sample of players to find maximums
			const sampleSize = Math.min(20, allAccounts.length);
			const sampleAccounts = allAccounts.slice(0, sampleSize);
			
			for (const account of sampleAccounts) {
				const playerData = await getPlayerData(account.nk_id, true);
				if (playerData) {
					// Check CHIMPS-BLACK count
					const chimpsBlack = playerData._medalsSinglePlayer?.["CHIMPS-BLACK"] ?? 0;
					if (chimpsBlack > maxChimpsBlack) {
						maxChimpsBlack = chimpsBlack;
					}
					
					// Check achievements
					const achievements = playerData.achievements ?? 0;
					if (achievements > maxAchievements) {
						maxAchievements = achievements;
					}
				}
			}
			
			// Use the maximum values found as the current totals
			if (maxChimpsBlack > 0) {
				currentTotalMaps = maxChimpsBlack;
			}
			if (maxAchievements > 0) {
				currentTotalAchievements = maxAchievements;
			}
		}
		
		// If we couldn't determine current values, use defaults
		// These defaults should only be used if API doesn't provide values and we can't infer from players
		if (!currentTotalMaps) {
			currentTotalMaps = 82; // Default fallback (will be updated when API provides or we find a player with more)
			logger.warn(`🐵 Could not determine total maps from API or players, using default: 82`, false);
		}
		if (!currentTotalAchievements) {
			currentTotalAchievements = 153; // Default fallback (will be updated when API provides or we find a player with more)
			logger.warn(`🐵 Could not determine total achievements from API or players, using default: 153`, false);
		}
		
		// Check if baseline exists
		if (!contentBaseline) {
			// First run - set baseline
			contentBaseline = {
				totalMaps: currentTotalMaps,
				totalAchievements: currentTotalAchievements,
				lastChecked: new Date(),
			};
			logger.info(`🐵 Content checker initialized: ${currentTotalMaps} maps, ${currentTotalAchievements} achievements`, false);
			return false; // No new content on first run
		}
		
		// Compare with baseline
		const newMaps = currentTotalMaps > contentBaseline.totalMaps;
		const newAchievements = currentTotalAchievements > contentBaseline.totalAchievements;
		
		if (newMaps || newAchievements) {
			logger.info(
				`🐵 New content detected! Maps: ${contentBaseline.totalMaps} → ${currentTotalMaps}, Achievements: ${contentBaseline.totalAchievements} → ${currentTotalAchievements}`,
				false
			);
			
			// Update baseline
			contentBaseline = {
				totalMaps: currentTotalMaps,
				totalAchievements: currentTotalAchievements,
				lastChecked: new Date(),
			};
			
			return true;
		}
		
		// Update last checked time
		contentBaseline.lastChecked = new Date();
		
		return false;
	} catch (error) {
		logger.error("🐵 Error checking for new content - the monkeys are confused!", false, error);
		return false;
	}
}

/**
 * Get current content limits (for use in role evaluation)
 */
export function getContentLimits(): { totalMaps: number; totalAchievements: number } {
	if (!contentBaseline) {
		// Return defaults if not initialized yet
		return {
			totalMaps: 82,
			totalAchievements: 153,
		};
	}
	
	return {
		totalMaps: contentBaseline.totalMaps,
		totalAchievements: contentBaseline.totalAchievements,
	};
}

/**
 * Manually update content limits (for staff command)
 * This will update the baseline and trigger role re-evaluation
 */
export function setContentLimits(totalMaps?: number, totalAchievements?: number): void {
	if (!contentBaseline) {
		contentBaseline = {
			totalMaps: totalMaps ?? 82,
			totalAchievements: totalAchievements ?? 153,
			lastChecked: new Date(),
		};
	} else {
		if (totalMaps !== undefined) {
			contentBaseline.totalMaps = totalMaps;
		}
		if (totalAchievements !== undefined) {
			contentBaseline.totalAchievements = totalAchievements;
		}
		contentBaseline.lastChecked = new Date();
	}
}

/**
 * Re-evaluate all users when new content is detected
 */
export async function reEvaluateAllUsersOnNewContent(client: Client): Promise<void> {
	try {
		const guild = await client.guilds.fetch(config.discord.guildId);
		if (!guild) {
			logger.error("🐵 Guild not found for content re-evaluation - even the monkeys are confused!");
			return;
		}
		
		const prisma = getPrismaClient();
		const users = await prisma.users.findMany({
			include: {
				nk_accounts: true,
			},
		});
		
		let processed = 0;
		let rolesRemoved = 0;
		
		for (const user of users) {
			if (user.nk_accounts.length === 0) {
				continue;
			}
			
			try {
				const roleDiff = await evaluateUserRoles(user.discord_id, true); // Force refresh
				
				// Check if any roles were removed (indicating user doesn't meet new requirements)
				if (roleDiff.rolesToRemove.length > 0) {
					rolesRemoved++;
					
					// Get role names for logging
					const roleNames: string[] = [];
					for (const roleId of roleDiff.rolesToRemove) {
						try {
							const role = await guild.roles.fetch(roleId);
							if (role) {
								roleNames.push(role.name);
							}
						} catch {
							roleNames.push("Unknown Role");
						}
					}
					
					// Get username for logging
					let username = user.discord_id;
					try {
						const member = await guild.members.fetch(user.discord_id);
						username = member.user.tag;
					} catch {
						// If we can't fetch member, use ID
					}
					
					logger.info(
						`🐵 Role removed because a new map or achievement has appeared. The user ${username} hasn't earned this one yet, so the Monkeys have reclaimed the role until they beat it! Removed roles: ${roleNames.join(", ")}`,
						false
					);
				}
				
				await applyRoleChanges(guild, user.discord_id, roleDiff, true, false);
				processed++;
			} catch (error) {
				logger.error(`🐵 Error re-evaluating user ${user.discord_id} - the monkeys are having trouble!`, false, error);
			}
		}
		
		logger.info(`🐵 Content re-evaluation complete: ${processed} users processed, ${rolesRemoved} users had roles removed`, false);
	} catch (error) {
		logger.error("🐵 Error in content re-evaluation - the monkeys are confused!", false, error);
	}
}

