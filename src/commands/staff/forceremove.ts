import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { validateNKID, sanitizeNKID } from "../../utils/validation.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import { applyRoleChanges } from "../../utils/roleManager.js";

export const data = new SlashCommandBuilder()
	.setName("forceremove")
	.setDescription("Force remove an NKID from a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to remove the account from")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("nkid")
			.setDescription("The NKID to remove")
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
	const nkId = sanitizeNKID(interaction.options.getString("nkid", true));

	if (!validateNKID(nkId)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Invalid NKID", "Please provide a valid Ninja Kiwi account ID.")],
		});
		return;
	}

	const prisma = getPrismaClient();

	try {
		const account = await prisma.nk_accounts.findFirst({
			where: {
				discord_id: targetUser.id,
				nk_id: nkId,
			},
		});

		if (!account) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"This NKID is not linked to this user.",
					),
				],
			});
			return;
		}

		// Remove account
		await prisma.nk_accounts.delete({
			where: { id: account.id },
		});

		// Recalculate roles (skip automatic DM, staff commands don't send DMs to users)
		const roleDiff = await evaluateUserRoles(targetUser.id, false);
		await applyRoleChanges(interaction.guild!, targetUser.id, roleDiff, true);

		// Get role names for embed
		const roleNames: string[] = [];
		for (const roleId of roleDiff.rolesToRemove) {
			try {
				const role = await interaction.guild!.roles.fetch(roleId);
				if (role) roleNames.push(role.name);
			} catch {
				roleNames.push("Unknown Role");
			}
		}

		const embed = createSuccessEmbed(
			"Account Force Removed",
			`Account has been force-removed from ${targetUser.tag}.`,
		);

		if (roleDiff.rolesToRemove.length > 0) {
			embed.addFields({
				name: "Roles Removed",
				value: roleNames.map(name => `• ${name}`).join("\n") || "None",
			});
		}

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`Staff command /forceremove used by ${interaction.user.tag}: Removed account from ${targetUser.tag}`,
		);
	} catch (error) {
		console.error("Error force removing account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while force removing the account. Please try again later.",
				),
			],
		});
		logger.error(`Error in /forceremove: ${error}`);
	}
}

