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

import dotenv from "dotenv";

dotenv.config();

interface DiscordConfig {
	token: string;
	clientId: string;
	guildId: string;
	ownerIds: string[];
	roles: {
		fastMonkey: string;
		bossSlayer: string;
		expertCompletionist: string;
		advancedCompletionist: string;
		grandmaster: string;
		theDartLord: string;
		allAchievements: string;
	};
	channels: {
		logs: string;
	};
	flaggedModdedPlayer?: string;
}

interface NKConfig {
	apiBase: string;
}

interface CacheConfig {
	duration: number; // in minutes
}

interface SyncConfig {
	interval: number; // in minutes
}

export interface Config {
	discord: DiscordConfig;
	nk: NKConfig;
	cache: CacheConfig;
	sync: SyncConfig;
	database: {
		url: string;
	};
}

function getEnv(key: string): string {
	const value = process.env[key];
	if (!value) {
		throw new Error(`Missing required environment variable: ${key}`);
	}
	return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
	const value = process.env[key];
	if (!value) {
		if (defaultValue !== undefined) {
			return defaultValue;
		}
		throw new Error(`Missing required environment variable: ${key}`);
	}
	const num = parseInt(value, 10);
	if (isNaN(num)) {
		throw new Error(`Invalid number for environment variable ${key}: ${value}`);
	}
	return num;
}

function getEnvOptional(key: string): string | undefined {
	return process.env[key];
}

const config: Config = {
	discord: {
		token: getEnv("DISCORD_TOKEN"),
		clientId: getEnv("DISCORD_CLIENT_ID"),
		guildId: getEnv("DISCORD_GUILD_ID"),
		ownerIds: getEnv("DISCORD_OWNER_ID")
			.split(",")
			.map(id => id.trim())
			.filter(id => id.length > 0),
		roles: {
			fastMonkey: getEnv("ROLE_FAST_MONKEY"),
			bossSlayer: getEnv("ROLE_BOSS_SLAYER"),
			expertCompletionist: getEnv("ROLE_EXPERT_COMPLETIONIST"),
			advancedCompletionist: getEnv("ROLE_ADVANCED_COMPLETIONIST"),
			grandmaster: getEnv("ROLE_GRANDMASTER"),
			theDartLord: getEnv("ROLE_THE_DART_LORD"),
			allAchievements: getEnv("ROLE_ALL_ACHIEVEMENTS"),
		},
		channels: {
			logs: getEnv("CHANNEL_LOGS"),
		},
		flaggedModdedPlayer: getEnvOptional("FLAGGED_MODDED_PLAYER"),
	},
	nk: {
		apiBase: getEnv("NK_API_BASE"),
	},
	cache: {
		duration: getEnvNumber("CACHE_DURATION", 10),
	},
	sync: {
		interval: getEnvNumber("SYNC_INTERVAL", 15),
	},
	database: {
		url: getEnv("DATABASE_URL"),
	},
};

export default config;

