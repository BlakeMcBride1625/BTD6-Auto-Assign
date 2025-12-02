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

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { validateOAK, sanitizeOAK } from "../../utils/validation.js";
import {
	createSuccessEmbed,
	createErrorEmbed,
} from "../../utils/embeds.js";
import { applyRoleChanges } from "../../utils/roleManager.js";
import { logger } from "../../utils/logger.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";
import { checkApiKeyValid } from "../../utils/apiValidation.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
	.setName("unlink")
	.setDescription("Unlink a Ninja Kiwi account from your Discord account")
	.addStringOption((option) =>
		option
			.setName("account")
			.setDescription("The Open Access Key (OAK) to unlink")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	// Check API key validity before proceeding
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

	const oak = sanitizeOAK(interaction.options.getString("account", true));

	if (!validateOAK(oak)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Invalid OAK", "Whoa there, that's not a valid OAK. Even Quincy never misses, but this one sure did!")],
		});
		return;
	}

	const prisma = getPrismaClient();
	const discordId = interaction.user.id;

	try {
		// Check if account exists and belongs to user
		const account = await prisma.nk_accounts.findFirst({
			where: {
				discord_id: discordId,
				nk_id: oak,
			},
		});

		if (!account) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"That OAK doesn't look quite right... even the Dart Monkey is confused! This OAK is not linked to your Discord account.",
					),
				],
			});
			return;
		}

		// Store display name before deletion
		const displayName = account.display_name || "Unknown";

		// Remove account
		await prisma.nk_accounts.delete({
			where: { id: account.id },
		});

		// Recalculate roles (skip automatic DM, we'll send combined one)
		const roleDiff = await evaluateUserRoles(discordId, false);
		await applyRoleChanges(interaction.guild!, discordId, roleDiff, true);

		// Get remaining linked accounts for the embed
		const remainingAccounts = await prisma.nk_accounts.findMany({
			where: { discord_id: discordId },
			select: { nk_id: true },
		});
		const remainingOaks = remainingAccounts.map((acc) => acc.nk_id);

		// Get role names and mentions for embed and logging
		const roleNames: string[] = [];
		const roleMentions: string[] = [];
		for (const roleId of roleDiff.rolesToRemove) {
			try {
				const role = await interaction.guild!.roles.fetch(roleId);
				if (role) {
					roleNames.push(role.name);
					roleMentions.push(`<@&${roleId}>`);
				}
			} catch {
				roleNames.push("Unknown Role");
			}
		}

		// Create combined embed
		const embed = createSuccessEmbed(
			"Account Unlinked",
			`Your account has been unlinked successfully.`,
		);

		embed.setAuthor({
			name: interaction.user.tag,
			iconURL: interaction.user.displayAvatarURL(),
		});

		// Add remaining linked accounts (OAK IDs) - only in DMs
		if (remainingOaks.length > 0) {
			embed.addFields({
				name: "Remaining Linked Account(s)",
				value: remainingOaks.map((id) => `\`${id}\``).join("\n"),
				inline: false,
			});
		}

		if (roleDiff.rolesToRemove.length > 0) {
			embed.addFields({
				name: "❌ Roles Removed",
				value: roleNames.map(name => `• ${name}`).join("\n") || "None",
				inline: false,
			});
		}

		// Send combined DM (auto-deletes after 12 hours)
		try {
			await sendDMWithAutoDelete(interaction.user, [embed]);
			await interaction.editReply({
				embeds: [createSuccessEmbed("Check your DMs!", "I've sent you a message with the unlink details.")],
			});
		} catch (dmError) {
			// If DM fails, send in channel as fallback
			await interaction.editReply({ embeds: [embed] });
		}

		// Log to log channel (embedded, with role mentions, without OAK ID)
		logger.logAccountUnlinked(interaction.user, displayName, roleMentions);
	} catch (error) {
		console.error("Error unlinking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky with that OAK. Try again, hero!",
				),
			],
		});
	}
}

