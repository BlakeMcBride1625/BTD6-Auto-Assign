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

// NK API response wrapper
export interface NKAPIResponse {
	success?: boolean;
	error?: string | null;
	body?: NKPlayerResponse;
	model?: {
		name?: string;
		parameters?: {
			achievements?: {
				description?: string;
				type?: string;
			};
			[key: string]: unknown;
		};
		[key: string]: unknown;
	};
	next?: string | null;
	prev?: string | null;
	// NOTE: The API does NOT provide totalMaps or totalAchievements as metadata.
	// These must be inferred from player data (max CHIMPS-BLACK count = total maps,
	// max achievements count = total achievements).
	[key: string]: unknown; // Allow other fields
}

// Actual NK API response structure
export interface NKPlayerResponse {
	displayName?: string;
	rank?: number; // Overall rank
	veteranRank?: number;
	achievements?: number; // Total count, not object
	_medalsBoss?: {
		GoldDiamond?: number;
		Silver?: number;
		RedDiamond?: number;
		BlackDiamond?: number;
		BlueDiamond?: number;
		DoubleGold?: number;
		GoldSilver?: number;
		Bronze?: number;
		[key: string]: number | undefined;
	};
	_medalsRace?: {
		DoubleGold?: number;
		GoldDiamond?: number;
		GoldSilver?: number;
		BlueDiamond?: number;
		RedDiamond?: number;
		BlackDiamond?: number;
		[key: string]: number | undefined;
	};
	_medalsSinglePlayer?: Record<string, number>; // e.g., "CHIMPS-BLACK": 14
	_medalsMultiplayer?: Record<string, number>; // Co-op medals
	bossBadgesNormal?: Record<string, number>;
	bossBadgesElite?: Record<string, number>;
	gameplay?: {
		highestRound?: number;
		highestRoundCHIMPS?: number;
		[key: string]: unknown;
	};
	// Legacy support for old structure
	stats?: {
		race?: { rank?: number };
		boss?: { rank?: number };
		maps?: Record<string, unknown>;
		achievements?: Record<string, { unlocked?: boolean }>;
	};
}

export interface CachedPlayerData {
	nk_id: string;
	json_data: NKPlayerResponse;
	last_updated: Date;
}

