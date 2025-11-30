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
	nkIds: string[],
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

	// Add NKID info
	if (nkIds.length > 0) {
		embed.addFields({
			name: "Linked Account(s)",
			value: nkIds.map((id) => `\`${id}\``).join("\n"),
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

