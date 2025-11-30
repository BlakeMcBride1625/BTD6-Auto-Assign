import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { getPrismaClient } from "../../database/client.js";
import { evaluateUserRoles } from "../../roles/evaluateRoles.js";
import { hasStaffAccess } from "../../utils/permissions.js";
import { createInfoEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { logger } from "../../utils/logger.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
	.setName("checkuser")
	.setDescription("Check a user's linked accounts and stats (Staff only)")
	.addUserOption((option) =>
		option
			.setName("user")
			.setDescription("The user to check")
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
						`${targetUser.tag} has no linked OAKs.`,
					),
				],
			});
			return;
		}

		const roleDiff = await evaluateUserRoles(targetUser.id, false);

		const embed = createInfoEmbed(
			`User Info: ${targetUser.tag}`,
			`**User ID:** ${targetUser.id}`,
		);

		// Show linked accounts (without OAK IDs for security)
		const accountInfo = accounts.map((acc: { display_name: string | null; linked_at: Date }, index: number) => {
			return `**Account ${index + 1}**\nDisplay: ${acc.display_name || "Unknown"}\nLinked: ${acc.linked_at.toLocaleDateString()}`;
		}).join("\n\n");

		embed.addFields({
			name: `Linked Accounts (${accounts.length})`,
			value: accountInfo,
		});

		// Show stats
		if (roleDiff.stats.raceRank) {
			embed.addFields({
				name: "Race Rank",
				value: roleDiff.stats.raceRank.toString(),
				inline: true,
			});
		}

		if (roleDiff.stats.bossRank) {
			embed.addFields({
				name: "Boss Rank",
				value: roleDiff.stats.bossRank.toString(),
				inline: true,
			});
		}

		// Show roles
		const roleNames: string[] = [];
		const roleMapping = {
			fastMonkey: "Fast Monkey",
			bossSlayer: "Boss Slayer",
			expertCompletionist: "Expert Completionist",
			advancedCompletionist: "Advanced Completionist",
			grandmaster: "Grandmaster",
			theDartLord: "The Dart Lord",
			allAchievements: "All Achievements",
		};

		for (const [key, name] of Object.entries(roleMapping)) {
			const roleId = config.discord.roles[key as keyof typeof config.discord.roles];
			if (roleDiff.rolesToAdd.includes(roleId)) {
				roleNames.push(`✅ ${name}`);
			} else {
				roleNames.push(`❌ ${name}`);
			}
		}

		if (roleNames.length > 0) {
			embed.addFields({
				name: "Roles",
				value: roleNames.join("\n"),
			});
		}

		await interaction.editReply({ embeds: [embed] });

		// Log to log channel
		logger.info(`Staff command /checkuser used by ${interaction.user.tag} on ${targetUser.tag}`);
	} catch (error) {
		console.error("Error checking user:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred while checking the user. Please try again later.",
				),
			],
		});
		logger.error(`Error in /checkuser: ${error}`);
	}
}

