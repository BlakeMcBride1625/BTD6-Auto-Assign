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
import { hasStaffAccess } from "../../utils/permissions.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import { setContentLimits, getContentLimits, reEvaluateAllUsersOnNewContent } from "../../utils/contentChecker.js";
import { Client } from "discord.js";
import { checkApiKeyValid } from "../../utils/apiValidation.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
	.setName("updatecontent")
	.setDescription("Update content limits (total maps/achievements) and re-evaluate all users (Staff only)")
	.addIntegerOption((option) =>
		option
			.setName("totalmaps")
			.setDescription("New total maps count (leave empty to keep current)")
			.setRequired(false)
			.setMinValue(1),
	)
	.addIntegerOption((option) =>
		option
			.setName("totalachievements")
			.setDescription("New total achievements count (leave empty to keep current)")
			.setRequired(false)
			.setMinValue(1),
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

	if (!interaction.member || !(await hasStaffAccess(interaction.member as any))) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Permission Denied", "You don't have permission to use this command.")],
		});
		return;
	}

	const totalMaps = interaction.options.getInteger("totalmaps");
	const totalAchievements = interaction.options.getInteger("totalachievements");

	// At least one value must be provided
	if (totalMaps === null && totalAchievements === null) {
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Invalid Input",
					"You must provide at least one value to update (totalmaps or totalachievements).",
				),
			],
		});
		return;
	}

	try {
		// Get current limits
		const currentLimits = getContentLimits();
		const oldMaps = currentLimits.totalMaps;
		const oldAchievements = currentLimits.totalAchievements;

		// Update limits
		setContentLimits(
			totalMaps ?? undefined,
			totalAchievements ?? undefined,
		);

		// Get new limits
		const newLimits = getContentLimits();
		const newMaps = newLimits.totalMaps;
		const newAchievements = newLimits.totalAchievements;

		// Check if anything actually changed
		const mapsChanged = totalMaps !== null && totalMaps !== oldMaps;
		const achievementsChanged = totalAchievements !== null && totalAchievements !== oldAchievements;

		if (!mapsChanged && !achievementsChanged) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"No Changes",
						"The provided values are the same as the current limits. No update needed.",
					),
				],
			});
			return;
		}

		// Create success embed
		const embed = createSuccessEmbed(
			"Content Limits Updated",
			`Content limits have been updated successfully. Re-evaluating all users...`,
		);

		const changes: string[] = [];
		if (mapsChanged) {
			changes.push(`**Total Maps**: ${oldMaps} → ${newMaps}`);
		}
		if (achievementsChanged) {
			changes.push(`**Total Achievements**: ${oldAchievements} → ${newAchievements}`);
		}

		embed.addFields({
			name: "Changes",
			value: changes.join("\n"),
			inline: false,
		});

		await interaction.editReply({ embeds: [embed] });

		// Trigger role re-evaluation for all users
		logger.info(
			`🐵 Staff command /updatecontent used by ${interaction.user.tag}: Updated content limits (Maps: ${oldMaps}→${newMaps}, Achievements: ${oldAchievements}→${newAchievements})`,
			false
		);

		// Re-evaluate all users with the new limits
		// We need the client instance, but we can get it from the interaction's guild
		if (interaction.client) {
			await reEvaluateAllUsersOnNewContent(interaction.client as Client);
			
			// Update embed with completion
			const completionEmbed = createSuccessEmbed(
				"✅ Content Update Complete",
				`Content limits updated and all users have been re-evaluated!`,
			);
			completionEmbed.addFields({
				name: "Changes",
				value: changes.join("\n"),
				inline: false,
			});
			completionEmbed.addFields({
				name: "Current Limits",
				value: `**Total Maps**: ${newMaps}\n**Total Achievements**: ${newAchievements}`,
				inline: false,
			});

			await interaction.editReply({ embeds: [completionEmbed] });
		} else {
			logger.warn("🐵 Could not get client instance for re-evaluation - the monkeys are confused!", false);
		}
	} catch (error) {
		console.error("Error updating content limits:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky while updating content limits. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /updatecontent - the monkeys are having trouble!`, false, error);
	}
}

