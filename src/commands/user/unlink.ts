import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { validateNKID, sanitizeNKID } from "../../utils/validation.js";
import {
	createSuccessEmbed,
	createErrorEmbed,
} from "../../utils/embeds.js";
import { applyRoleChanges } from "../../utils/roleManager.js";
import { logger } from "../../utils/logger.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";

export const data = new SlashCommandBuilder()
	.setName("unlink")
	.setDescription("Unlink a Ninja Kiwi account from your Discord account")
	.addStringOption((option) =>
		option
			.setName("account")
			.setDescription("The Ninja Kiwi account ID (NKID) to unlink")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const nkId = sanitizeNKID(interaction.options.getString("account", true));

	if (!validateNKID(nkId)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Invalid NKID", "Please provide a valid Ninja Kiwi account ID.")],
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
				nk_id: nkId,
			},
		});

		if (!account) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"This NKID is not linked to your Discord account.",
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
		const remainingNkIds = remainingAccounts.map((acc) => acc.nk_id);

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
		if (remainingNkIds.length > 0) {
			embed.addFields({
				name: "Remaining Linked Account(s)",
				value: remainingNkIds.map((id) => `\`${id}\``).join("\n"),
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
					"An error occurred while unlinking your account. Please try again later.",
				),
			],
		});
	}
}

