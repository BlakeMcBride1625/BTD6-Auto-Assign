import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { getPlayerData } from "../../nk/cache.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { validateNKID, sanitizeNKID } from "../../utils/validation.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import { applyRoleChanges } from "../../utils/roleManager.js";

export const data = new SlashCommandBuilder()
	.setName("forcelink")
	.setDescription("Force link an NKID to a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to link the account to")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("nkid")
			.setDescription("The NKID to link")
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
		// Check if NKID exists and is linked to another user
		const existingAccount = await prisma.nk_accounts.findUnique({
			where: { nk_id: nkId },
		});

		if (existingAccount && existingAccount.discord_id !== targetUser.id) {
			// Remove from previous user (skip DM, staff action)
			await prisma.nk_accounts.delete({
				where: { nk_id: nkId },
			});

			// Recalculate roles for previous user (skip DM, staff action)
			const prevRoleDiff = await evaluateUserRoles(existingAccount.discord_id, false);
			await applyRoleChanges(interaction.guild!, existingAccount.discord_id, prevRoleDiff, true);
		}

		// Check if user already has this NKID
		const userAccount = await prisma.nk_accounts.findFirst({
			where: {
				discord_id: targetUser.id,
				nk_id: nkId,
			},
		});

		if (userAccount) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Already Linked",
						"This NKID is already linked to this user.",
					),
				],
			});
			return;
		}

		// Fetch player data
		const playerData = await getPlayerData(nkId, true);

		if (!playerData) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"Could not find a player with that NKID.",
					),
				],
			});
			return;
		}

		// Create or update user
		await prisma.users.upsert({
			where: { discord_id: targetUser.id },
			update: {},
			create: { discord_id: targetUser.id },
		});

		// Link NKID
		await prisma.nk_accounts.create({
			data: {
				discord_id: targetUser.id,
				nk_id: nkId,
				display_name: playerData.displayName ?? null,
			},
		});

		// Evaluate and apply roles (skip automatic DM, staff commands don't send DMs to users)
		const roleDiff = await evaluateUserRoles(targetUser.id, true);
		await applyRoleChanges(interaction.guild!, targetUser.id, roleDiff, true);

		// Get role names for embed
		const roleNames: string[] = [];
		for (const roleId of roleDiff.rolesToAdd) {
			try {
				const role = await interaction.guild!.roles.fetch(roleId);
				if (role) roleNames.push(role.name);
			} catch {
				roleNames.push("Unknown Role");
			}
		}

		const embed = createSuccessEmbed(
			"Account Force Linked",
			`Account has been force-linked to ${targetUser.tag}.`,
		);

		if (playerData.displayName) {
			embed.addFields({ name: "Display Name", value: playerData.displayName, inline: true });
		}

		if (roleDiff.rolesToAdd.length > 0) {
			embed.addFields({
				name: "Roles Added",
				value: roleNames.map(name => `• ${name}`).join("\n") || "None",
			});
		}

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`Staff command /forcelink used by ${interaction.user.tag}: Linked account to ${targetUser.tag}`,
		);
	} catch (error) {
		console.error("Error force linking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while force linking the account. Please try again later.",
				),
			],
		});
		logger.error(`Error in /forcelink: ${error}`);
	}
}

