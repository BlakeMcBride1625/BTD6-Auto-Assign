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

