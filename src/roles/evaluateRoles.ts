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

import { getPrismaClient } from "../database/client.js";
import config from "../config/config.js";
import { getPlayerData } from "../nk/cache.js";
import { evaluateAllRoles } from "./requirements.js";
import type { NKPlayerResponse } from "../nk/types.js";
import { getContentLimits } from "../utils/contentChecker.js";
import { isAccountFlagged } from "../utils/flagDetection.js";
import { checkApiKeyValid } from "../utils/apiValidation.js";
import { getAwardedRoles } from "../utils/roleManager.js";

export interface RoleDiff {
	rolesToAdd: string[];
	rolesToRemove: string[];
	stats: {
		raceRank?: number;
		bossRank?: number;
		expertMapsCompleted?: number;
		totalBlackChimps?: number;
		blackBordersSolo?: number;
		blackBordersCoop?: number;
		achievementsUnlocked?: number;
		totalAchievements?: number;
	};
}

export async function evaluateUserRoles(
	discordId: string,
	forceRefresh = false,
): Promise<RoleDiff> {
	// Check API key validity before proceeding
	const isApiValid = await checkApiKeyValid(config.api.key);
	if (!isApiValid) {
		// Return empty RoleDiff if API is invalid - don't modify roles
		return {
			rolesToAdd: [],
			rolesToRemove: [],
			stats: {},
		};
	}

	const prisma = getPrismaClient();

	// Get all linked OAKs for this user
	const nkAccounts = await prisma.nk_accounts.findMany({
		where: { discord_id: discordId },
	});

	if (nkAccounts.length === 0) {
		return {
			rolesToAdd: [],
			rolesToRemove: [],
			stats: {},
		};
	}

	// Fetch player data for all OAKs
	const playerDataPromises = nkAccounts.map((account: { nk_id: string }) =>
		getPlayerData(account.nk_id, forceRefresh),
	);
	const playerDataResults = await Promise.all(playerDataPromises);
	const playerData = playerDataResults.filter(
		(data: NKPlayerResponse | null): data is NKPlayerResponse => data !== null,
	);

	if (playerData.length === 0) {
		return {
			rolesToAdd: [],
			rolesToRemove: [],
			stats: {},
		};
	}

	// Check for flagged accounts - if any account is flagged, return empty RoleDiff
	// (no achievement roles should be assigned to flagged accounts)
	const flaggedAccounts = playerData.filter((data) => isAccountFlagged(data));
	if (flaggedAccounts.length > 0) {
		// Return empty RoleDiff - no achievement roles for flagged accounts
		return {
			rolesToAdd: [],
			rolesToRemove: [],
			stats: {},
		};
	}

	// Evaluate roles
	const roleResults = evaluateAllRoles(playerData);

	// Get roles that have already been awarded to this user via OAK
	const awardedRoles = await getAwardedRoles(discordId);

	const rolesToAdd: string[] = [];
	const rolesToRemove: string[] = [];

	const roleMapping = {
		fastMonkey: config.discord.roles.fastMonkey,
		bossSlayer: config.discord.roles.bossSlayer,
		expertCompletionist: config.discord.roles.expertCompletionist,
		advancedCompletionist: config.discord.roles.advancedCompletionist,
		grandmaster: config.discord.roles.grandmaster,
		theDartLord: config.discord.roles.theDartLord,
		allAchievements: config.discord.roles.allAchievements,
	};

	// Only add roles that user qualifies for but doesn't already have tracked
	// Never remove roles if user still has OAKs (even if they no longer qualify)
	// Role removal is handled separately via clearAwardedRoles() when user has no OAKs
	for (const [key, roleId] of Object.entries(roleMapping)) {
		const shouldHave = roleResults[key as keyof typeof roleResults];
		if (shouldHave && !awardedRoles.includes(roleId)) {
			rolesToAdd.push(roleId);
		}
	}

	// Calculate stats for display
	const latestData = playerData[playerData.length - 1];
	const stats = {
		raceRank: undefined as number | undefined,
		bossRank: undefined as number | undefined,
		expertMapsCompleted: 0,
		totalBlackChimps: latestData?._medalsSinglePlayer?.["CHIMPS-BLACK"] ?? 0,
		blackBordersSolo: 0,
		blackBordersCoop: 0,
		achievementsUnlocked: latestData?.achievements ?? 0,
		totalAchievements: getContentLimits().totalAchievements,
	};

	return {
		rolesToAdd,
		rolesToRemove,
		stats,
	};
}

