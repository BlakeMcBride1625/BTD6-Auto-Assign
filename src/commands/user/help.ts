/**
 * Copyright (c) 2025 Blake McBride (blakemcbride1625)
 * All Rights Reserved
 * 
 * EpildevConnect Ltd is a trademark of Blake McBride.
 * 
 * This code is proprietary and confidential. Unauthorised copying, modification,
 * distribution, or use of this software, via any medium, is strictly prohibited
 * without the express written permission of Blake McBride.
 * 
 * Contact:
 *   - GitHub: blakemcbride1625
 *   - Discord: epildev
 */

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
	GuildMember,
} from "discord.js";
import { createInfoEmbed, createErrorEmbed } from "../../utils/embeds.js";
import { hasStaffAccess, isOwner } from "../../utils/permissions.js";
import { checkApiKeyValid } from "../../utils/apiValidation.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
	.setName("help")
	.setDescription("Get help and information about the bot commands");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	// Check API key validity before proceeding
	const isApiValid = await checkApiKeyValid(config.api.key);
	if (!isApiValid) {
		await interaction.reply({
			embeds: [
				createErrorEmbed(
					"Service Unavailable",
					"The bot is currently unavailable due to API validation issues. Please contact staff.",
				),
			],
			ephemeral: true,
		});
		return;
	}

	if (!interaction.guild || !interaction.member) {
		await interaction.reply({
			embeds: [createInfoEmbed("Error", "This command can only be used in a server.")],
			ephemeral: true,
		});
		return;
	}

	// Fetch full member if needed (interaction.member might be partial)
	const member = interaction.member instanceof GuildMember 
		? interaction.member 
		: await interaction.guild.members.fetch(interaction.user.id);
	
	const isStaffUser = await hasStaffAccess(member);
	const isOwnerUser = isOwner(interaction.user.id);

	const embed = createInfoEmbed(
		"BTD6 Role Bot - Help",
		"This bot automatically manages roles based on your Bloons TD 6 achievements and stats.",
	);

	// Always show getting started section with OAK info
	embed.addFields({
		name: "🚀 Getting Started",
		value: [
			"**IMPORTANT: You need an Open Access Key (OAK), not your regular NKID!**",
			"",
			"**How to get your OAK:**",
			"1. Open Bloons TD 6",
			"2. Go to **Settings** → **Open Data**",
			"3. Generate an **Open Access Key (OAK)**",
			"4. Use that OAK with `/verify account:<OAK>`",
			"",
			"**Note:** Your in-game NKID is different from the OAK needed for the API.",
		].join("\n"),
	});

	// User commands - always shown
	embed.addFields({
		name: "👤 User Commands",
		value: [
			"`/verify account:<OAK>` - Link your Ninja Kiwi account (requires OAK)",
			"`/unlink account:<OAK>` - Unlink a Ninja Kiwi account",
			"`/myaccounts` - View all your linked accounts",
			"`/myroles` - View your current roles and progression",
			"`/help` - Show this help message",
		].join("\n"),
	});

	// Staff commands - only shown to staff
	if (isStaffUser) {
			embed.addFields({
				name: "🛡️ Staff Commands",
				value: [
					"`/checkuser user:<User>` - View user's linked accounts and stats",
					"`/forcelink user:<User> oak:<OAK>` - Force link an account (removes from previous owner if needed)",
					"`/forceremove user:<User> [oak:<OAK>]` - Force remove an account (leave OAK empty to remove all)",
					"`/forcerolesync user:<User>` - Force role recalculation for a user",
					"`/listall user:<User>` - List all linked accounts for a user",
					"`/updatecontent [totalmaps:<number>] [totalachievements:<number>]` - Update content limits and re-evaluate all users",
				].join("\n"),
			});
	}

	// Owner commands - only shown to owner
	if (isOwnerUser) {
		embed.addFields({
			name: "👑 Owner Commands",
			value: [
				"`/addstaff user:<User>` - Add a user to staff",
				"`/removestaff user:<User>` - Remove a user from staff",
			].join("\n"),
		});
	}

	// Role requirements - always shown
	embed.addFields({
		name: "🏆 Role Requirements",
		value: [
			"**Fast Monkey**: Race rank ≤ 50",
			"**Boss Slayer**: Boss rank ≤ 3",
			"**Expert Completionist**: All Expert maps with black CHIMPS (solo)",
			"**Advanced Completionist**: ≥ 25 solo black CHIMPS medals (summed across all linked accounts)",
			"**Grandmaster**: Black border on all maps (solo)",
			"**The Dart Lord**: Black border on all maps (solo + co-op)",
			"**All Achievements**: All BTD6 achievements unlocked on at least one linked account",
		].join("\n"),
	});

	// Important notes - always shown
	embed.addFields({
		name: "ℹ️ Important Notes",
		value: [
			"• Each OAK can only be linked to one Discord account",
			"• You can link multiple OAKs to your Discord account",
			"• Roles are automatically synced every 15 minutes",
			"• If the API is unavailable, roles are never removed (safety first!)",
		].join("\n"),
	});

	await interaction.reply({ embeds: [embed], ephemeral: true });
}

