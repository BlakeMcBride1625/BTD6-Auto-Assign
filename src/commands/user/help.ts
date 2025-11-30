import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { createInfoEmbed } from "../../utils/embeds.js";

export const data = new SlashCommandBuilder()
	.setName("help")
	.setDescription("Get help and information about the bot commands");

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	const embed = createInfoEmbed(
		"BTD6 Role Bot - Help",
		"This bot automatically manages roles based on your Bloons TD 6 achievements and stats.",
	);

	embed.addFields(
		{
			name: "User Commands",
			value: [
				"`/link account:<NKID>` - Link your Ninja Kiwi account",
				"`/unlink account:<NKID>` - Unlink a Ninja Kiwi account",
				"`/myaccounts` - View all linked accounts",
				"`/myroles` - View your current roles and progression",
				"`/help` - Show this help message",
			].join("\n"),
		},
		{
			name: "Staff Commands",
			value: [
				"`/checkuser user:<User>` - View user's linked accounts and stats",
				"`/forcelink user:<User> nkid:<NKID>` - Force link an account",
				"`/forceremove user:<User> nkid:<NKID>` - Force remove an account",
				"`/forcerolesync user:<User>` - Force role recalculation",
				"`/listall user:<User>` - List all linked accounts for a user",
			].join("\n"),
		},
		{
			name: "Owner Commands",
			value: [
				"`/addstaff user:<User>` - Add a user to staff (Owner only)",
				"`/removestaff user:<User>` - Remove a user from staff (Owner only)",
			].join("\n"),
		},
		{
			name: "Role Requirements",
			value: [
				"**Fast Monkey**: Race rank ≤ 50",
				"**Boss Slayer**: Boss rank ≤ 3",
				"**Expert Completionist**: All Expert maps with black CHIMPS (solo)",
				"**Advanced Completionist**: ≥ 25 solo black CHIMPS medals (summed across NKIDs)",
				"**Grandmaster**: Black border on all maps (solo)",
				"**The Dart Lord**: Black border on all maps (solo + co-op)",
				"**All Achievements**: All BTD6 achievements unlocked on at least one NKID",
			].join("\n"),
		},
		{
			name: "Important Notes",
			value: [
				"• Each NKID can only be linked to one Discord account",
				"• You can link multiple NKIDs to your Discord account",
				"• Roles are automatically synced every few minutes",
				"• If the API is unavailable, roles are never removed",
			].join("\n"),
		},
	);

	await interaction.reply({ embeds: [embed] });
}

