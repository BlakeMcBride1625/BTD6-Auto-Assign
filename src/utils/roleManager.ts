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

import { Guild, Role } from "discord.js";
import type { RoleDiff } from "../roles/evaluateRoles.js";
import { logger } from "./logger.js";
import { createRoleRewardEmbed } from "./embeds.js";
import { getPrismaClient } from "../database/client.js";
import { sendDMWithAutoDelete } from "./dmManager.js";

/**
 * Track a role as being awarded via OAK
 */
export async function trackRoleAwarded(discordId: string, roleId: string): Promise<void> {
	try {
		const prisma = getPrismaClient();
		// Check if role is already tracked
		const existing = await prisma.roles_awarded.findFirst({
			where: {
				discord_id: discordId,
				role_id: roleId,
			},
		});

		if (!existing) {
			// Only create if it doesn't exist (avoid duplicates)
			await prisma.roles_awarded.create({
				data: {
					discord_id: discordId,
					role_id: roleId,
					awarded_at: new Date(),
				},
			});
		} else {
			// Update timestamp if it already exists
			await prisma.roles_awarded.update({
				where: { id: existing.id },
				data: { awarded_at: new Date() },
			});
		}
	} catch (error) {
		logger.error(`🐵 Error tracking role ${roleId} for ${discordId} - the monkeys are having trouble!`, false, error);
	}
}

/**
 * Get all roles that have been awarded to a user via OAK
 */
export async function getAwardedRoles(discordId: string): Promise<string[]> {
	try {
		const prisma = getPrismaClient();
		const awardedRoles = await prisma.roles_awarded.findMany({
			where: { discord_id: discordId },
			select: { role_id: true },
		});
		return awardedRoles.map((r) => r.role_id);
	} catch (error) {
		logger.error(`🐵 Error getting awarded roles for ${discordId} - the monkeys are confused!`, false, error);
		return [];
	}
}

/**
 * Clear all awarded roles for a user (when they have no OAKs or leave server)
 * Returns the role IDs that were cleared
 */
export async function clearAwardedRoles(guild: Guild, discordId: string): Promise<string[]> {
	try {
		const prisma = getPrismaClient();
		
		// Get all awarded roles
		const awardedRoles = await prisma.roles_awarded.findMany({
			where: { discord_id: discordId },
			select: { role_id: true },
		});

		if (awardedRoles.length === 0) {
			return [];
		}

		const roleIds = awardedRoles.map((r) => r.role_id);

		// Try to remove roles from Discord member (if they're still in the guild)
		try {
			const member = await guild.members.fetch(discordId);
			
			for (const roleId of roleIds) {
				try {
					const role = await guild.roles.fetch(roleId);
					if (role && member.roles.cache.has(roleId)) {
						await member.roles.remove(role);
						logger.info(`🐵 Removed role ${role.name} from ${member.user.tag} - the monkeys have reclaimed it!`);
					}
				} catch (error) {
					// Role might not exist or member might not have it, that's okay
					logger.warn(`🐵 Could not remove role ${roleId} from ${discordId}`, false);
				}
			}
		} catch (error) {
			// Member might have left the guild, that's okay - we'll still clean up the database
			logger.warn(`🐵 Could not fetch member ${discordId} for role cleanup - they may have left the guild`, false);
		}

		// Remove all tracked roles from database
		await prisma.roles_awarded.deleteMany({
			where: { discord_id: discordId },
		});

		return roleIds;
	} catch (error) {
		logger.error(`🐵 Error clearing awarded roles for ${discordId} - the monkeys are having trouble!`, false, error);
		return [];
	}
}

export async function applyRoleChanges(
	guild: Guild,
	discordId: string,
	roleDiff: RoleDiff,
	skipDM = false,
	silent = false,
): Promise<void> {
	try {
		let member;
		try {
			member = await guild.members.fetch(discordId);
		} catch (error: any) {
			// Handle "Unknown Member" error (user left the server)
			if (error?.code === 10007 || error?.rawError?.code === 10007) {
				// User has left the server - clean up their OAKs and tracked roles
				const prisma = getPrismaClient();
				const nkAccounts = await prisma.nk_accounts.findMany({
					where: { discord_id: discordId },
				});

				if (nkAccounts.length > 0) {
					// User has OAKs but left server - clean up
					await clearAwardedRoles(guild, discordId);
					if (!silent) {
						logger.info(`🐵 User ${discordId} left the server with ${nkAccounts.length} linked OAK(s). Cleaned up tracked roles.`, false);
					}
				}
				// Silently return - don't log as error since this is expected behavior
				return;
			}
			// Re-throw other errors
			throw error;
		}

		if (!member) {
			logger.warn(`🐵 Member ${discordId} not found in guild - even the monkeys can't find them!`);
			return;
		}

		const user = member.user;
		const currentRoleIds = member.roles.cache.map((role: Role) => role.id);
		const rolesAdded: string[] = [];
		const rolesRemoved: string[] = [];
		const roleNamesAdded: string[] = [];
		const roleNamesRemoved: string[] = [];

		// Add roles
		for (const roleId of roleDiff.rolesToAdd) {
			if (!currentRoleIds.includes(roleId)) {
				try {
					const role = await guild.roles.fetch(roleId);
					if (role) {
						await member.roles.add(role);
						rolesAdded.push(roleId);
						roleNamesAdded.push(role.name);
						// Track role as awarded via OAK
						await trackRoleAwarded(discordId, roleId);
						if (!silent) {
							logger.info(`🐵 Added role ${role.name} to ${user.tag} - the monkeys are celebrating!`);
						}
					}
				} catch (error) {
					logger.error(`🐵 Failed to add role ${roleId} to ${user.tag} - the monkeys are having trouble!`, false, error);
				}
			}
		}

		// Remove roles
		for (const roleId of roleDiff.rolesToRemove) {
			if (currentRoleIds.includes(roleId)) {
				try {
					const role = await guild.roles.fetch(roleId);
					if (role) {
						await member.roles.remove(role);
						rolesRemoved.push(roleId);
						roleNamesRemoved.push(role.name);
						if (!silent) {
							logger.info(`🐵 Removed role ${role.name} from ${user.tag} - the monkeys have reclaimed it!`);
						}
					}
				} catch (error) {
					logger.error(`🐵 Failed to remove role ${roleId} from ${user.tag} - the monkeys are having trouble!`, false, error);
				}
			}
		}

		// Send DM if roles changed (unless skipDM is true)
		if (!skipDM && (rolesAdded.length > 0 || rolesRemoved.length > 0)) {
			try {
				// Get linked OAKs for the embed
				const prisma = getPrismaClient();
				const oakAccounts = await prisma.nk_accounts.findMany({
					where: { discord_id: discordId },
					select: { nk_id: true },
				});
				const oakIds = oakAccounts.map((acc: { nk_id: string }) => acc.nk_id);

				const dmEmbed = createRoleRewardEmbed(user, oakIds, roleNamesAdded, roleNamesRemoved);
				await sendDMWithAutoDelete(user, [dmEmbed]);
			} catch (error) {
				// User might have DMs disabled, that's okay
				logger.warn(`🐵 Could not send DM to ${user.tag} - the monkeys tried but couldn't reach them!`, false, error);
			}
		}
	} catch (error) {
		logger.error(`🐵 Error applying role changes for ${discordId} - the monkeys are having trouble!`, false, error);
		throw error;
	}
}

export async function getCurrentRoles(guild: Guild, discordId: string): Promise<string[]> {
	try {
		const member = await guild.members.fetch(discordId);
		if (!member) {
			return [];
		}
		return member.roles.cache.map((role: Role) => role.id);
	} catch (error) {
		logger.error(`🐵 Error getting current roles for ${discordId} - the monkeys are confused!`, false, error);
		return [];
	}
}

