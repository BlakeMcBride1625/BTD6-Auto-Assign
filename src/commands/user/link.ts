import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { getPlayerData } from "../../nk/cache.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { validateNKID, sanitizeNKID } from "../../utils/validation.js";
import {
	createSuccessEmbed,
	createErrorEmbed,
	createWarningEmbed,
} from "../../utils/embeds.js";
import { applyRoleChanges } from "../../utils/roleManager.js";
import { logger } from "../../utils/logger.js";
import { sendDMWithAutoDelete } from "../../utils/dmManager.js";

export const data = new SlashCommandBuilder()
	.setName("link")
	.setDescription("Link your Ninja Kiwi account to your Discord account")
	.addStringOption((option) =>
		option
			.setName("account")
			.setDescription("Your Open Access Key (OAK) - Get it from BTD6 Settings → Open Data")
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

	const discordId = interaction.user.id;

	try {
		const prisma = getPrismaClient();
		
		// Check if NKID is already linked to another user
		const existingAccount = await prisma.nk_accounts.findUnique({
			where: { nk_id: nkId },
			include: { user: true },
		});

		if (existingAccount && existingAccount.discord_id !== discordId) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Already Linked",
						`This NKID is already linked to another Discord account. Each NKID can only be linked to one Discord account.`,
					),
				],
			});
			return;
		}

		// Check if user already has this NKID linked
		const userAccount = await prisma.nk_accounts.findFirst({
			where: {
				discord_id: discordId,
				nk_id: nkId,
			},
		});

		if (userAccount) {
			await interaction.editReply({
				embeds: [
					createWarningEmbed(
						"Already Linked",
						"This NKID is already linked to your account.",
					),
				],
			});
			return;
		}

		// Fetch player data from API
		const playerData = await getPlayerData(nkId, true);

		if (!playerData) {
			await interaction.editReply({
				embeds: [
					createErrorEmbed(
						"Account Not Found",
						"Could not find a player with that ID. The API requires:\n\n**You need an Open Access Key (OAK), not just your NKID!**\n\n**How to get your OAK:**\n1. Open BTD6\n2. Go to Settings → Open Data\n3. Generate an Open Access Key (OAK)\n4. Use that OAK (not your regular NKID) with `/link`\n\n**Note:** The in-game NKID is different from the OAK needed for the API.",
					),
				],
			});
			return;
		}

		// Create or update user
		await prisma.users.upsert({
			where: { discord_id: discordId },
			update: {},
			create: { discord_id: discordId },
		});

		// Link NKID
		await prisma.nk_accounts.create({
			data: {
				discord_id: discordId,
				nk_id: nkId,
				display_name: playerData.displayName ?? null,
			},
		});

		// Evaluate and apply roles (skip automatic DM, we'll send combined one)
		const roleDiff = await evaluateUserRoles(discordId, true);
		await applyRoleChanges(interaction.guild!, discordId, roleDiff, true);

		// Get linked NKIDs for the combined embed
		const nkAccounts = await prisma.nk_accounts.findMany({
			where: { discord_id: discordId },
			select: { nk_id: true },
		});
		const nkIds = nkAccounts.map((acc: { nk_id: string }) => acc.nk_id);

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
		if (nkIds.length > 0) {
			combinedEmbed.addFields({
				name: "Linked Account(s)",
				value: nkIds.map((id) => `\`${id}\``).join("\n"),
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
		console.error("Error linking account:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while linking your account. Please try again later.",
				),
			],
		});
	}
}

