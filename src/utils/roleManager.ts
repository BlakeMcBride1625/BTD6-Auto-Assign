import { Guild, Role } from "discord.js";
import type { RoleDiff } from "../roles/evaluateRoles.js";
import { logger } from "./logger.js";
import { createRoleRewardEmbed } from "./embeds.js";
import { getPrismaClient } from "../database/client.js";
import { sendDMWithAutoDelete } from "./dmManager.js";

export async function applyRoleChanges(
	guild: Guild,
	discordId: string,
	roleDiff: RoleDiff,
	skipDM = false,
): Promise<void> {
	try {
		const member = await guild.members.fetch(discordId);
		if (!member) {
			logger.warn(`Member ${discordId} not found in guild`);
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
						logger.info(`Added role ${role.name} to ${user.tag}`);
					}
				} catch (error) {
					logger.error(`Failed to add role ${roleId} to ${user.tag}:`, error);
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
						logger.info(`Removed role ${role.name} from ${user.tag}`);
					}
				} catch (error) {
					logger.error(`Failed to remove role ${roleId} from ${user.tag}:`, error);
				}
			}
		}

		// Send DM if roles changed (unless skipDM is true)
		if (!skipDM && (rolesAdded.length > 0 || rolesRemoved.length > 0)) {
			try {
				// Get linked NKIDs for the embed
				const prisma = getPrismaClient();
				const nkAccounts = await prisma.nk_accounts.findMany({
					where: { discord_id: discordId },
					select: { nk_id: true },
				});
				const nkIds = nkAccounts.map((acc: { nk_id: string }) => acc.nk_id);

				const dmEmbed = createRoleRewardEmbed(user, nkIds, roleNamesAdded, roleNamesRemoved);
				await sendDMWithAutoDelete(user, [dmEmbed]);
			} catch (error) {
				// User might have DMs disabled, that's okay
				logger.warn(`Could not send DM to ${user.tag}:`, error);
			}
		}
	} catch (error) {
		logger.error(`Error applying role changes for ${discordId}:`, error);
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
		logger.error(`Error getting current roles for ${discordId}:`, error);
		return [];
	}
}

