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
import { isOwner } from "../../utils/permissions.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
	.setName("removestaff")
	.setDescription("Remove a user from staff (Owner only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to remove from staff")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	if (!isOwner(interaction.user.id)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Permission Denied", "Only the bot owner can use this command.")],
		});
		return;
	}

	const targetUser = interaction.options.getUser("user", true);
	const prisma = getPrismaClient();

	try {
		// Check if user is staff
		const staff = await prisma.staff_users.findUnique({
			where: { discord_id: targetUser.id },
		});

		if (!staff) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Not Staff",
						`${targetUser.tag} is not a staff member.`,
					),
				],
			});
			return;
		}

		// Remove from staff
		await prisma.staff_users.delete({
			where: { discord_id: targetUser.id },
		});

		const embed = createSuccessEmbed(
			"Staff Removed",
			`${targetUser.tag} has been removed from staff.`,
		);

		embed.addFields({
			name: "Removed By",
			value: interaction.user.tag,
			inline: true,
		});

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`🐵 Owner command /removestaff used by ${interaction.user.tag}: Removed ${targetUser.tag} from staff`,
			false
		);
	} catch (error) {
		console.error("Error removing staff:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /removestaff - the monkeys are having trouble!`, false, error);
	}
}

