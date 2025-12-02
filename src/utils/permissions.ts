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

