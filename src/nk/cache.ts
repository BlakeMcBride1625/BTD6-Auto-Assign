import { getPrismaClient } from "../database/client.js";
import config from "../config/config.js";
import { fetchPlayerData } from "./fetchPlayer.js";
import type { NKPlayerResponse } from "./types.js";

export async function getPlayerData(nkId: string, forceRefresh = false): Promise<NKPlayerResponse | null> {
	const prisma = getPrismaClient();
	const cacheDurationMs = config.cache.duration * 60 * 1000; // Convert minutes to milliseconds

	// Check cache first
	if (!forceRefresh) {
		const cached = await prisma.cache_player_data.findUnique({
			where: { nk_id: nkId },
		});

		if (cached) {
			const age = Date.now() - cached.last_updated.getTime();
			if (age < cacheDurationMs) {
				return cached.json_data as NKPlayerResponse;
			}
		}
	}

	// Fetch from API
	const data = await fetchPlayerData(nkId);
	if (!data) {
		// If API fails and we have cached data, return stale cache
		if (!forceRefresh) {
			const staleCache = await prisma.cache_player_data.findUnique({
				where: { nk_id: nkId },
			});
			if (staleCache) {
				return staleCache.json_data as NKPlayerResponse;
			}
		}
		return null;
	}

	// Update cache
	await prisma.cache_player_data.upsert({
		where: { nk_id: nkId },
		update: {
			json_data: data as any,
			last_updated: new Date(),
		},
		create: {
			nk_id: nkId,
			json_data: data as any,
			last_updated: new Date(),
		},
	});

	return data;
}

