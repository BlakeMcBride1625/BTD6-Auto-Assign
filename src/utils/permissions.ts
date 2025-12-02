import { GuildMember, PermissionFlagsBits } from "discord.js";
import config from "../config/config.js";
import { getPrismaClient } from "../database/client.js";

export function isOwner(userId: string): boolean {
	return config.discord.ownerIds.includes(userId);
}

export async function isStaff(userId: string): Promise<boolean> {
	if (isOwner(userId)) {
		return true;
	}

	const prisma = getPrismaClient();
	const staff = await prisma.staff_users.findUnique({
		where: { discord_id: userId },
	});

	return staff !== null;
}

export function hasStaffPermissions(member: GuildMember | null): boolean {
	if (!member) {
		return false;
	}

	return member.permissions.has([
		PermissionFlagsBits.Administrator,
		PermissionFlagsBits.ManageRoles,
	]);
}

export async function hasStaffAccess(member: GuildMember | null): Promise<boolean> {
	if (!member) {
		return false;
	}

	// Owner always has access
	if (isOwner(member.id)) {
		return true;
	}

	// Check if user is in staff database
	const isStaffUser = await isStaff(member.id);
	if (isStaffUser) {
		return true;
	}

	// Fallback to permission check
	return hasStaffPermissions(member);
}

