import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import { applyRoleChanges } from "../../utils/roleManager.js";

export const data = new SlashCommandBuilder()
	.setName("forcerolesync")
	.setDescription("Force a role sync for a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to sync roles for")
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

	try {
		// Force refresh and evaluate roles (skip automatic DM, staff commands don't send DMs to users)
		const roleDiff = await evaluateUserRoles(targetUser.id, true);
		await applyRoleChanges(interaction.guild!, targetUser.id, roleDiff, true);

		const embed = createSuccessEmbed(
			"Role Sync Complete",
			`Roles have been force-synced for ${targetUser.tag}.`,
		);

		// Get role names for embed
		const roleNamesAdded: string[] = [];
		const roleNamesRemoved: string[] = [];
		
		for (const roleId of roleDiff.rolesToAdd) {
			try {
				const role = await interaction.guild!.roles.fetch(roleId);
				if (role) roleNamesAdded.push(role.name);
			} catch {
				roleNamesAdded.push("Unknown Role");
			}
		}
		
		for (const roleId of roleDiff.rolesToRemove) {
			try {
				const role = await interaction.guild!.roles.fetch(roleId);
				if (role) roleNamesRemoved.push(role.name);
			} catch {
				roleNamesRemoved.push("Unknown Role");
			}
		}

		if (roleDiff.rolesToAdd.length > 0) {
			embed.addFields({
				name: "Roles Added",
				value: roleNamesAdded.map(name => `• ${name}`).join("\n") || "None",
			});
		}

		if (roleDiff.rolesToRemove.length > 0) {
			embed.addFields({
				name: "Roles Removed",
				value: roleNamesRemoved.map(name => `• ${name}`).join("\n") || "None",
			});
		}

		if (roleDiff.rolesToAdd.length === 0 && roleDiff.rolesToRemove.length === 0) {
			embed.setDescription(`No role changes needed for ${targetUser.tag}.`);
		}

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(
			`🐵 Staff command /forcerolesync used by ${interaction.user.tag} on ${targetUser.tag}`,
			false
		);
	} catch (error) {
		console.error("Error force syncing roles:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /forcerolesync - the monkeys are having trouble!`, false, error);
	}
}

