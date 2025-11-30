import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { createInfoEmbed, createErrorEmbed, createSuccessEmbed } from "../../utils/embeds.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";

export const data = new SlashCommandBuilder()
	.setName("myaccounts")
	.setDescription("View all Ninja Kiwi accounts linked to your Discord account");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const prisma = getPrismaClient();
	const discordId = interaction.user.id;

	try {
		const accounts = await prisma.nk_accounts.findMany({
			where: { discord_id: discordId },
			orderBy: { linked_at: "desc" },
		});

		if (accounts.length === 0) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"No Accounts Linked",
						"You don't have any Ninja Kiwi accounts linked. Use `/link` to link an account.",
					),
				],
			});
			return;
		}

		const embed = createInfoEmbed(
			"Your Linked Accounts",
			`You have **${accounts.length}** account(s) linked to your Discord account.`,
		);

		embed.setAuthor({
			name: interaction.user.tag,
			iconURL: interaction.user.displayAvatarURL(),
		});

		accounts.forEach((account, index) => {
			const displayName = account.display_name || "Unknown";
			const linkedDate = account.linked_at.toLocaleDateString();
			embed.addFields({
				name: `Account ${index + 1}`,
				value: `**Display Name:** ${displayName}\n**Linked:** ${linkedDate}`,
				inline: false,
			});
		});

		// Send DM instead of channel reply (auto-deletes after 12 hours)
		try {
			await sendDMWithAutoDelete(interaction.user, [embed]);
			await interaction.editReply({
				embeds: [createSuccessEmbed("Check your DMs!", "I've sent you a message with your linked accounts.")],
			});
		} catch (dmError) {
			// If DM fails, send in channel as fallback
			await interaction.editReply({ embeds: [embed] });
		}
	} catch (error) {
		console.error("Error fetching accounts:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while fetching your accounts. Please try again later.",
				),
			],
		});
	}
}

