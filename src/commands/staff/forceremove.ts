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
	.setDescription("Force remove an OAK or all accounts from a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to remove the account(s) from")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("nkid")
			.setDescription("The Open Access Key (OAK) to remove (leave empty to remove all)")
			.setRequired(false),
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
	const nkIdInput = interaction.options.getString("nkid", false);
	const prisma = getPrismaClient();

	try {
		// If no OAK provided, remove all accounts
		if (!nkIdInput) {
			const allAccounts = await prisma.nk_accounts.findMany({
				where: { discord_id: targetUser.id },
			});

			if (allAccounts.length === 0) {
				await interaction.editReply({
					embeds: [
						createErrorEmbed(
							"No Accounts Found",
							`${targetUser.tag} has no linked accounts to remove.`,
						),
					],
				});
				return;
			}

			// Remove all accounts
			await prisma.nk_accounts.deleteMany({
				where: { discord_id: targetUser.id },
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
				"All Accounts Force Removed",
				`All ${allAccounts.length} account(s) have been force-removed from ${targetUser.tag}.`,
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
				`Staff command /forceremove used by ${interaction.user.tag}: Removed all ${allAccounts.length} account(s) from ${targetUser.tag}`,
			);
			return;
		}

		// Single account removal (existing logic)
		const nkId = sanitizeNKID(nkIdInput);

		if (!validateNKID(nkId)) {
			await interaction.editReply({
				embeds: [createErrorEmbed("Invalid OAK", "Please provide a valid Open Access Key (OAK).")],
			});
			return;
		}

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
						"This OAK is not linked to this user.",
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

