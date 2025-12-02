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

import { EmbedBuilder, User } from "discord.js";

export enum EmbedColor {
	Success = 0x00ff00, // Green
	Warning = 0xffff00, // Yellow
	Error = 0xff0000, // Red
	Info = 0x0099ff, // Blue
}

export function createEmbed(
	title: string,
	description?: string,
	color: EmbedColor = EmbedColor.Info,
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setTitle(title)
		.setColor(color)
		.setTimestamp();

	if (description) {
		embed.setDescription(description);
	}

	return embed;
}

export function createSuccessEmbed(title: string, description?: string): EmbedBuilder {
	return createEmbed(title, description, EmbedColor.Success);
}

export function createWarningEmbed(title: string, description?: string): EmbedBuilder {
	return createEmbed(title, description, EmbedColor.Warning);
}

export function createErrorEmbed(title: string, description?: string): EmbedBuilder {
	return createEmbed(title, description, EmbedColor.Error);
}

export function createInfoEmbed(title: string, description?: string): EmbedBuilder {
	return createEmbed(title, description, EmbedColor.Info);
}

export function createRoleRewardEmbed(
	user: User,
	oakIds: string[],
	roleNamesAdded: string[],
	roleNamesRemoved: string[],
): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setAuthor({
			name: user.tag,
			iconURL: user.displayAvatarURL(),
		})
		.setColor(EmbedColor.Success)
		.setTimestamp();

	// Add OAK info
	if (oakIds.length > 0) {
		embed.addFields({
			name: "Linked Account(s)",
			value: oakIds.map((id) => `\`${id}\``).join("\n"),
			inline: false,
		});
	}

	// Add roles gained
	if (roleNamesAdded.length > 0) {
		embed.addFields({
			name: "🎉 Roles Earned",
			value: roleNamesAdded.map((name) => `• ${name}`).join("\n"),
			inline: false,
		});
	}

	// Add roles removed (if any)
	if (roleNamesRemoved.length > 0) {
		embed.addFields({
			name: "❌ Roles Removed",
			value: roleNamesRemoved.map((name) => `• ${name}`).join("\n"),
			inline: false,
		});
	}

	// Set title and description
	if (roleNamesAdded.length > 0 && roleNamesRemoved.length === 0) {
		embed.setTitle("🎉 You Have Been Rewarded These Roles!");
		embed.setDescription(`Congratulations ${user.username}! Based on your BTD6 achievements, you have earned the following roles:`);
	} else if (roleNamesAdded.length > 0 && roleNamesRemoved.length > 0) {
		embed.setTitle("🔄 Your Roles Have Been Updated");
		embed.setDescription(`Your role assignments have been updated based on your current BTD6 achievements.`);
	} else if (roleNamesRemoved.length > 0) {
		embed.setTitle("⚠️ Roles Removed");
		embed.setDescription(`Some roles have been removed as they no longer meet the requirements.`);
		embed.setColor(EmbedColor.Warning);
	} else {
		embed.setTitle("Role Status");
		embed.setDescription(`Your current role assignments are up to date.`);
		embed.setColor(EmbedColor.Info);
	}

	return embed;
}

export function createFlaggedAccountEmbed(user: User, accountId: string): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setAuthor({
			name: user.tag,
			iconURL: user.displayAvatarURL(),
		})
		.setTitle("🍃 Uh Oh! The Green Leaf Has Appeared!")
		.setColor(EmbedColor.Warning)
		.setDescription(
			`Hey there, ${user.username}! The monkeys have spotted something... your BTD6 account has been marked with the **green leaf flag** by Ninja Kiwi! 🍃\n\n` +
			`This little green leaf means your account has been detected as having **modded or altered gameplay**. The monkeys are a bit confused - they can't tell if those bananas are real or not! 🐵🍌\n\n` +
			`**What this means:**\n` +
			`• Your account has been flagged for modded/cheated gameplay\n` +
			`• Normal achievement roles cannot be assigned to flagged accounts\n` +
			`• The monkeys need legitimate gameplay to hand out those sweet role rewards\n\n` +
			`**Account ID:** \`${accountId}\`\n\n` +
			`If you believe this is an error, you'll need to contact Ninja Kiwi support. The monkeys here can't remove that green leaf - only the banana overlords at Ninja Kiwi can! 🍌👑`
		)
		.setTimestamp();

	return embed;
}

export function createFlaggedAccountLogEmbed(user: User, accountId: string): EmbedBuilder {
	const embed = new EmbedBuilder()
		.setTitle("🍃 Flagged Account Detected - Green Leaf Alert!")
		.setColor(EmbedColor.Warning)
		.setTimestamp()
		.addFields(
			{
				name: "Discord User",
				value: `${user.tag} (${user.id})`,
				inline: true,
			},
			{
				name: "Account ID",
				value: `\`${accountId}\``,
				inline: true,
			},
			{
				name: "Flag Status",
				value: "🍃 Account has the green leaf flag (modded/cheated)",
				inline: false,
			}
		);

	return embed;
}

