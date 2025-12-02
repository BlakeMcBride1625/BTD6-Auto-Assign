import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../../database/client.js";
import { getPlayerData } from "../../nk/cache.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { validateOAK, sanitizeOAK } from "../../utils/validation.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import { applyRoleChanges } from "../../utils/roleManager.js";

export const data = new SlashCommandBuilder()
	.setName("forcelink")
	.setDescription("Force link an OAK to a user (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to link the account to")
			.setRequired(true),
	)
	.addStringOption((option) =>
		option
			.setName("oak")
			.setDescription("The Open Access Key (OAK) to link")
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
	const oak = sanitizeOAK(interaction.options.getString("oak", true));

	if (!validateOAK(oak)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Invalid OAK", "Whoa there, that's not a valid OAK. Even Quincy never misses, but this one sure did!")],
		});
		return;
	}

	const prisma = getPrismaClient();

	// Fetch player data first (before transaction to avoid holding lock)
	const playerData = await getPlayerData(oak, true);

	if (!playerData) {
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Account Not Found",
					"That OAK doesn't look quite right... even the Dart Monkey is confused!",
				),
			],
		});
		return;
	}

	let previousDiscordId: string | null = null;

	try {
		// Use transaction to atomically check and create, preventing race conditions
		await prisma.$transaction(async (tx) => {
			// Check if OAK exists and is linked to another user
			const existingAccount = await tx.nk_accounts.findUnique({
				where: { nk_id: oak },
			});

			if (existingAccount) {
				if (existingAccount.discord_id === targetUser.id) {
					// Already linked to this user
					throw new Error("ALREADY_LINKED_SELF");
				}
				// Store previous user ID for role recalculation
				previousDiscordId = existingAccount.discord_id;

				// Remove from previous user (skip DM, staff action)
				await tx.nk_accounts.delete({
					where: { nk_id: oak },
				});
			}

			// Create or update user
			await tx.users.upsert({
				where: { discord_id: targetUser.id },
				update: {},
				create: { discord_id: targetUser.id },
			});

			// Link OAK - this will fail with unique constraint if race condition occurs
			await tx.nk_accounts.create({
				data: {
					discord_id: targetUser.id,
					nk_id: oak,
					display_name: playerData.displayName ?? null,
				},
			});
		});

		// Recalculate roles for previous user if account was moved (outside transaction)
		if (previousDiscordId) {
			try {
				const prevRoleDiff = await evaluateUserRoles(previousDiscordId, false);
				await applyRoleChanges(interaction.guild!, previousDiscordId, prevRoleDiff, true);
			} catch (error) {
				logger.error(`🐵 Error recalculating roles for previous user ${previousDiscordId} - the monkeys are having trouble!`, false, error);
			}
		}

	} catch (error) {
		// Handle specific error cases
		if (error instanceof Error && error.message === "ALREADY_LINKED_SELF") {
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

		// Handle Prisma unique constraint violation (race condition caught by DB)
		if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
			// Check which account actually has it now
			const existingAccount = await prisma.nk_accounts.findUnique({
				where: { nk_id: oak },
			});

			if (existingAccount && existingAccount.discord_id !== targetUser.id) {
				await interaction.editReply({
					embeds: [
						createErrorEmbed(
							"Account Already Linked",
							`Naughty Naughty... that OAK is already linked to another player's Discord. No double-banana dipping allowed, silly monkey! Use /forceremove first if you need to move it.`,
						),
					],
				});
				return;
			}

			// Same user somehow (shouldn't happen, but handle gracefully)
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Already Linked",
						"This OAK is already bonded tighter than a Glue Monkey. Pick another!",
					),
				],
			});
			return;
		}

		// Generic error handling
		console.error("Error force linking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky with that OAK. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /forcelink - the monkeys are having trouble!`, false, error);
		return;
	}

	try {
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
			`🐵 Staff command /forcelink used by ${interaction.user.tag}: Linked account to ${targetUser.tag}`,
			false
		);
	} catch (error) {
		console.error("Error force linking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky with that OAK. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /forcelink - the monkeys are having trouble!`, false, error);
	}
}

