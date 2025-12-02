import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { PrismaClientKnownRequestError } from "@prisma/client/runtime/library";
import { getPrismaClient } from "../../database/client.js";
import { getPlayerData } from "../../nk/cache.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { validateOAK, sanitizeOAK } from "../../utils/validation.js";
import {
	createSuccessEmbed,
	createErrorEmbed,
	createWarningEmbed,
} from "../../utils/embeds.js";
import { applyRoleChanges } from "../../utils/roleManager.js";
import { logger } from "../../utils/logger.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";

export const data = new SlashCommandBuilder()
	.setName("verify")
	.setDescription("Link your Ninja Kiwi account to your Discord account")
	.addStringOption((option) =>
		option
			.setName("account")
			.setDescription("Your Open Access Key (OAK) - Get it from BTD6 Settings → Open Data")
			.setRequired(true),
	);

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	const oak = sanitizeOAK(interaction.options.getString("account", true));

	if (!validateOAK(oak)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Invalid OAK", "Whoa there, that's not a valid OAK. Even Quincy never misses, but this one sure did!")],
		});
		return;
	}

	const discordId = interaction.user.id;

	// Fetch player data from API first (before transaction to avoid holding lock)
	const playerData = await getPlayerData(oak, true);

		if (!playerData) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"That OAK doesn't look quite right... even the Dart Monkey is confused!\n\n**You need an Open Access Key (OAK), not just your NKID!**\n\n**How to get your OAK:**\n1. Open BTD6\n2. Go to Settings → Open Data\n3. Generate an Open Access Key (OAK)\n4. Use that OAK (not your regular NKID) with `/verify`\n\n**Note:** The in-game NKID is different from the OAK needed for the API.",
					),
				],
			});
			return;
		}

	try {
		const prisma = getPrismaClient();

		// Use transaction to atomically check and create, preventing race conditions
		await prisma.$transaction(async (tx) => {
			// Check if OAK is already linked to another user
			const existingAccount = await tx.nk_accounts.findUnique({
				where: { nk_id: oak },
			});

			if (existingAccount) {
				if (existingAccount.discord_id !== discordId) {
					throw new Error("ALREADY_LINKED_OTHER");
				}
				// Same user, already linked
				throw new Error("ALREADY_LINKED_SELF");
			}

			// Create or update user
			await tx.users.upsert({
				where: { discord_id: discordId },
				update: {},
				create: { discord_id: discordId },
			});

			// Link OAK - this will fail with unique constraint if race condition occurs
			await tx.nk_accounts.create({
				data: {
					discord_id: discordId,
					nk_id: oak,
					display_name: playerData.displayName ?? null,
				},
			});
		});

	} catch (error) {
		// Handle specific error cases
		if (error instanceof Error) {
			if (error.message === "ALREADY_LINKED_OTHER") {
				await interaction.editReply({
					embeds: [
						createErrorEmbed(
							"Account Already Linked",
							`Naughty Naughty... that OAK is already linked to another player's Discord. No double-banana dipping allowed, silly monkey!`,
						),
					],
				});
				return;
			}
			if (error.message === "ALREADY_LINKED_SELF") {
				await interaction.editReply({
					embeds: [
						createWarningEmbed(
							"Already Linked",
							"This OAK is already bonded tighter than a Glue Monkey. Pick another!",
						),
					],
				});
				return;
			}
		}

		// Handle Prisma unique constraint violation (race condition caught by DB)
		if (error instanceof PrismaClientKnownRequestError && error.code === "P2002") {
			// Check which account actually has it now
			const prisma = getPrismaClient();
			const existingAccount = await prisma.nk_accounts.findUnique({
				where: { nk_id: oak },
			});

			if (existingAccount && existingAccount.discord_id !== discordId) {
				await interaction.editReply({
					embeds: [
						createErrorEmbed(
							"Account Already Linked",
							`Naughty Naughty... that OAK is already linked to another player's Discord. No double-banana dipping allowed, silly monkey!`,
						),
					],
				});
				return;
			}

			// Same user somehow (shouldn't happen, but handle gracefully)
			await interaction.editReply({
				embeds: [
					createWarningEmbed(
						"Already Linked",
						"This OAK is already bonded tighter than a Glue Monkey. Pick another!",
					),
				],
			});
			return;
		}

		// Generic error handling
		console.error("Error linking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Hold your bananas... something went wonky with that OAK. Try again, hero!",
				),
			],
		});
		logger.error(`🐵 Error in /verify - the monkeys are having trouble!`, false, error);
		return;
	}

	try {
		const prisma = getPrismaClient();

		// Evaluate and apply roles (skip automatic DM, we'll send combined one)
		const roleDiff = await evaluateUserRoles(discordId, true);
		await applyRoleChanges(interaction.guild!, discordId, roleDiff, true);

		// Get linked OAKs for the combined embed
		const oakAccounts = await prisma.nk_accounts.findMany({
			where: { discord_id: discordId },
			select: { nk_id: true },
		});
		const oakIds = oakAccounts.map((acc: { nk_id: string }) => acc.nk_id);

		// Get role names and mentions for embed and logging
		const roleNames: string[] = [];
		const roleMentions: string[] = [];
		for (const roleId of roleDiff.rolesToAdd) {
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

		// Create combined embed with role rewards AND account details
		const combinedEmbed = createSuccessEmbed(
			"✅ Account Linked Successfully",
			`Your account has been linked and roles have been evaluated!`,
		);

		combinedEmbed.setAuthor({
			name: interaction.user.tag,
			iconURL: interaction.user.displayAvatarURL(),
		});

		// Add linked accounts (OAK IDs) - only in DMs
		if (oakIds.length > 0) {
			combinedEmbed.addFields({
				name: "Linked Account(s)",
				value: oakIds.map((id) => `\`${id}\``).join("\n"),
				inline: false,
			});
		}

		// Add display name
		if (playerData.displayName) {
			combinedEmbed.addFields({
				name: "Display Name",
				value: playerData.displayName,
				inline: true,
			});
		}

		// Add roles earned
		if (roleDiff.rolesToAdd.length > 0) {
			combinedEmbed.addFields({
				name: "🎉 Roles Earned",
				value: roleNames.map(name => `• ${name}`).join("\n") || "None",
				inline: false,
			});
		} else {
			combinedEmbed.addFields({
				name: "Roles",
				value: "No roles earned yet. Keep playing to unlock roles!",
				inline: false,
			});
		}

		// Add stats
		if (roleDiff.stats.totalBlackChimps) {
			combinedEmbed.addFields({
				name: "Black CHIMPS Medals",
				value: roleDiff.stats.totalBlackChimps.toString(),
				inline: true,
			});
		}

		if (roleDiff.stats.achievementsUnlocked) {
			combinedEmbed.addFields({
				name: "Achievements",
				value: `${roleDiff.stats.achievementsUnlocked}/${roleDiff.stats.totalAchievements}`,
				inline: true,
			});
		}

		// Send combined DM (auto-deletes after 12 hours)
		try {
			await sendDMWithAutoDelete(interaction.user, [combinedEmbed]);
			await interaction.editReply({
				embeds: [createSuccessEmbed("Check your DMs!", "I've sent you a message with your account details and role rewards.")],
			});
		} catch (dmError) {
			// If DM fails, send in channel as fallback
			await interaction.editReply({ embeds: [combinedEmbed] });
		}

		// Log to log channel (embedded, with role mentions, without OAK ID)
		const displayName = playerData.displayName || "Unknown";
		logger.logAccountLinked(interaction.user, displayName, roleMentions);
	} catch (error) {
		console.error("Error in post-link operations:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"Account was linked, but an error occurred during role evaluation. Please contact staff.",
				),
			],
		});
		logger.error(`🐵 Error in post-link operations - the monkeys are having trouble!`, false, error);
	}
}

