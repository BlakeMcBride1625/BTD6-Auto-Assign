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
import { getCurrentRoles } from "../../utils/roleManager.js";
import { createInfoEmbed, createErrorEmbed, createSuccessEmbed } from "../../utils/embeds.js";
import config from "../../config/config.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";

export const data = new SlashCommandBuilder()
	.setName("myroles")
	.setDescription("View your current roles and progression");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const prisma = getPrismaClient();
	const discordId = interaction.user.id;

	try {
		const accounts = await prisma.nk_accounts.findMany({
			where: { discord_id: discordId },
		});

		if (accounts.length === 0) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"No Accounts Linked",
						"You don't have any Ninja Kiwi accounts linked. Use `/verify` to link an account.",
					),
				],
			});
			return;
		}

		const roleDiff = await evaluateUserRoles(discordId, false);
		const currentRoles = await getCurrentRoles(interaction.guild!, discordId);

		const embed = createInfoEmbed("Your Roles & Progression", "");
		
		embed.setAuthor({
			name: interaction.user.tag,
			iconURL: interaction.user.displayAvatarURL(),
		});

		// Show current roles
		const rolesEarned: string[] = [];
		const rolesNotEarned: string[] = [];
		const roleMapping = {
			fastMonkey: "Fast Monkey",
			bossSlayer: "Boss Slayer",
			expertCompletionist: "Expert Completionist",
			advancedCompletionist: "Advanced Completionist",
			grandmaster: "Grandmaster",
			theDartLord: "The Dart Lord",
			allAchievements: "All Achievements",
		};

		for (const [key, name] of Object.entries(roleMapping)) {
			const roleId = config.discord.roles[key as keyof typeof config.discord.roles];
			if (currentRoles.includes(roleId)) {
				rolesEarned.push(`✅ ${name}`);
			} else if (roleDiff.rolesToAdd.includes(roleId)) {
				rolesEarned.push(`⏳ ${name} (pending)`);
			} else {
				rolesNotEarned.push(`❌ ${name}`);
			}
		}

		if (rolesEarned.length > 0) {
			embed.addFields({
				name: "🎉 Roles Earned",
				value: rolesEarned.join("\n"),
			});
		}

		if (rolesNotEarned.length > 0) {
			embed.addFields({
				name: "Roles Not Yet Earned",
				value: rolesNotEarned.join("\n"),
			});
		}

		// Show stats
		if (roleDiff.stats.raceRank) {
			embed.addFields({
				name: "Race Rank",
				value: roleDiff.stats.raceRank.toString(),
				inline: true,
			});
		}

		if (roleDiff.stats.bossRank) {
			embed.addFields({
				name: "Boss Rank",
				value: roleDiff.stats.bossRank.toString(),
				inline: true,
			});
		}

		if (roleDiff.stats.achievementsUnlocked !== undefined) {
			embed.addFields({
				name: "Achievements",
				value: `${roleDiff.stats.achievementsUnlocked}/${roleDiff.stats.totalAchievements}`,
				inline: true,
			});
		}

		// Send DM instead of channel reply (auto-deletes after 12 hours)
		try {
			await sendDMWithAutoDelete(interaction.user, [embed]);
			await interaction.editReply({
				embeds: [createSuccessEmbed("Check your DMs!", "I've sent you a message with your roles and progression.")],
			});
		} catch (dmError) {
			// If DM fails, send in channel as fallback
			await interaction.editReply({ embeds: [embed] });
		}
	} catch (error) {
		console.error("Error fetching roles:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while fetching your roles. Please try again later.",
				),
			],
		});
	}
}

