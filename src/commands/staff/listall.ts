import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { createInfoEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";

export const data = new SlashCommandBuilder()
	.setName("listall")
	.setDescription("List all linked NKIDs for a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to list accounts for")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	if (!interaction.member || !(await hasStaffAccess(interaction.member as any))) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Permission Denied", "You don't have permission to use this command.")],
		});
		return;
	}

	const targetUser = interaction.options.getUser("user", true);
	const prisma = getPrismaClient();

	try {
		const accounts = await prisma.nk_accounts.findMany({
			where: { discord_id: targetUser.id },
			orderBy: { linked_at: "desc" },
		});

		if (accounts.length === 0) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"No Accounts Found",
						`${targetUser.tag} has no linked NKIDs.`,
					),
				],
			});
			return;
		}

		const embed = createInfoEmbed(
			`Linked Accounts: ${targetUser.tag}`,
			`**User ID:** ${targetUser.id}\n**Total Accounts:** ${accounts.length}`,
		);

		const accountList = accounts.map((acc: { display_name: string | null; linked_at: Date }, index: number) => {
			return `${index + 1}. **Account ${index + 1}**\n   Display: ${acc.display_name || "Unknown"}\n   Linked: ${acc.linked_at.toLocaleDateString()}`;
		}).join("\n\n");

		embed.addFields({
			name: "Accounts",
			value: accountList,
		});

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`Staff command /listall used by ${interaction.user.tag} on ${targetUser.tag}`,
		);
	} catch (error) {
		console.error("Error listing accounts:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while listing accounts. Please try again later.",
				),
			],
		});
		logger.error(`Error in /listall: ${error}`);
	}
}

