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

import type { NKPlayerResponse } from "../nk/types.js";
import { getContentLimits } from "../utils/contentChecker.js";

// Fast Monkey: Race rank <= 50
// Using medal counts as proxy since API doesn't provide direct rank
export function checkFastMonkey(data: NKPlayerResponse | undefined): boolean {
	if (!data?._medalsRace) {
		return false;
	}
	const raceMedals = data._medalsRace;
	const doubleGold = raceMedals.DoubleGold ?? 0;
	const blackDiamond = raceMedals.BlackDiamond ?? 0;
	const goldDiamond = raceMedals.GoldDiamond ?? 0;
	
	// High race medal counts suggest top 50 race rank
	// Having 50+ DoubleGold medals or significant BlackDiamond medals suggests top 50
	return doubleGold >= 50 || (blackDiamond >= 10 && goldDiamond >= 50);
}

// Boss Slayer: Boss rank <= 3
// Using medal counts as proxy since API doesn't provide direct rank
export function checkBossSlayer(data: NKPlayerResponse | undefined): boolean {
	if (!data?._medalsBoss) {
		return false;
	}
	const bossMedals = data._medalsBoss;
	const blackDiamond = bossMedals.BlackDiamond ?? 0;
	
	// High boss medal counts suggest top 3 boss rank
	// Having 20+ BlackDiamond boss medals suggests top 3 rank
	return blackDiamond >= 20;
}

// Expert Completionist: ALL expert maps with black CHIMPS (solo)
// API doesn't provide per-map data, so we infer:
// If user has CHIMPS-BLACK count >= expert maps count, they likely have all expert maps
export function checkExpertCompletionist(data: NKPlayerResponse | undefined): boolean {
	if (!data?._medalsSinglePlayer) {
		return false;
	}
	const chimpsBlack = data._medalsSinglePlayer["CHIMPS-BLACK"] ?? 0;
	
	// If they have black CHIMPS on all or nearly all maps, they likely have all expert maps
	// This is an approximation - ideally we'd check per-map data
	const { totalMaps } = getContentLimits();
	return chimpsBlack >= totalMaps;
}

// Advanced Completionist: >= 25 solo black CHIMPS medals (summed across OAKs)
export function checkAdvancedCompletionist(allData: NKPlayerResponse[]): boolean {
	let totalBlackChimps = 0;

	for (const data of allData) {
		if (data._medalsSinglePlayer?.["CHIMPS-BLACK"]) {
			totalBlackChimps += data._medalsSinglePlayer["CHIMPS-BLACK"];
		}
	}

	return totalBlackChimps >= 25;
}

// Grandmaster: Black border on all maps (solo)
// API doesn't provide per-map black border data
// We can infer: if they have black CHIMPS on all maps, they likely have black borders
// This is an approximation
export function checkGrandmaster(data: NKPlayerResponse | undefined): boolean {
	if (!data?._medalsSinglePlayer) {
		return false;
	}
	const chimpsBlack = data._medalsSinglePlayer["CHIMPS-BLACK"] ?? 0;
	
	// If they have black CHIMPS on all maps, they likely have black borders on all maps
	// This is an approximation - ideally we'd check per-map black border data
	const { totalMaps } = getContentLimits();
	return chimpsBlack >= totalMaps;
}

// The Dart Lord: Black border on all maps (solo + co-op)
// API doesn't provide per-map black border data
// We can infer from multiplayer CHIMPS-BLACK count
export function checkTheDartLord(data: NKPlayerResponse | undefined): boolean {
	if (!data?._medalsSinglePlayer || !data?._medalsMultiplayer) {
		return false;
	}
	const soloChimpsBlack = data._medalsSinglePlayer["CHIMPS-BLACK"] ?? 0;
	const coopChimpsBlack = data._medalsMultiplayer["CHIMPS-BLACK"] ?? 0;
	
	// If they have black CHIMPS on all maps in both solo and co-op, they likely have black borders
	// This is an approximation
	const { totalMaps } = getContentLimits();
	return soloChimpsBlack >= totalMaps && coopChimpsBlack >= totalMaps;
}

// All Achievements: All BTD6 achievements unlocked on at least one OAK
export function checkAllAchievements(data: NKPlayerResponse | undefined): boolean {
	if (!data) {
		return false;
	}
	// Use dynamic total achievements from content checker
	const { totalAchievements } = getContentLimits();
	return (data.achievements ?? 0) >= totalAchievements;
}

export interface RoleCheckResult {
	fastMonkey: boolean;
	bossSlayer: boolean;
	expertCompletionist: boolean;
	advancedCompletionist: boolean;
	grandmaster: boolean;
	theDartLord: boolean;
	allAchievements: boolean;
}

export function evaluateAllRoles(
	allPlayerData: NKPlayerResponse[],
): RoleCheckResult {
	if (allPlayerData.length === 0) {
		return {
			fastMonkey: false,
			bossSlayer: false,
			expertCompletionist: false,
			advancedCompletionist: false,
			grandmaster: false,
			theDartLord: false,
			allAchievements: false,
		};
	}

	const latestData = allPlayerData[allPlayerData.length - 1];

	return {
		fastMonkey: checkFastMonkey(latestData),
		bossSlayer: checkBossSlayer(latestData),
		expertCompletionist: checkExpertCompletionist(latestData),
		advancedCompletionist: checkAdvancedCompletionist(allPlayerData),
		grandmaster: checkGrandmaster(latestData),
		theDartLord: checkTheDartLord(latestData),
		allAchievements: checkAllAchievements(latestData),
	};
}
