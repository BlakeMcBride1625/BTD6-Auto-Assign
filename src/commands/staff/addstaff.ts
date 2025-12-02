import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { isOwner } from "../../utils/permissions.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
	.setName("addstaff")
	.setDescription("Add a user to staff (Owner only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to add as staff")
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
		// Check if user is already staff
		const existingStaff = await prisma.staff_users.findUnique({
			where: { discord_id: targetUser.id },
		});

		if (existingStaff) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Already Staff",
						`${targetUser.tag} is already a staff member.`,
					),
				],
			});
			return;
		}

		// Add to staff
		await prisma.staff_users.create({
			data: {
				discord_id: targetUser.id,
				added_by: interaction.user.id,
			},
		});

		const embed = createSuccessEmbed(
			"Staff Added",
			`${targetUser.tag} has been added as a staff member.`,
		);

		embed.addFields({
			name: "Added By",
			value: interaction.user.tag,
			inline: true,
		});

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`🐵 Owner command /addstaff used by ${interaction.user.tag}: Added ${targetUser.tag} as staff`,
			false
		);
	} catch (error) {
		console.error("Error adding staff:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /addstaff - the monkeys are having trouble!`, false, error);
	}
}

