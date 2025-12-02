import config from "../config/config.js";
import type { NKPlayerResponse, NKAPIResponse } from "./types.js";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// Export function to get API metadata if available
export async function fetchAPIMetadata(nkId: string): Promise<{ totalMaps?: number; totalAchievements?: number } | null> {
	const url = `${config.nk.apiBase}${nkId}`;
	
	try {
		const response = await fetch(url, {
			method: "GET",
			headers: {
				"Accept": "application/json",
				"User-Agent": "BTD6-Role-Bot/1.0",
			},
		});

		const contentType = response.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			return null;
		}

		const jsonData = await response.json() as NKAPIResponse;
		
		// Check if API provides metadata directly
		if (jsonData.totalMaps !== undefined || jsonData.totalAchievements !== undefined) {
			return {
				totalMaps: typeof jsonData.totalMaps === 'number' ? jsonData.totalMaps : undefined,
				totalAchievements: typeof jsonData.totalAchievements === 'number' ? jsonData.totalAchievements : undefined,
			};
		}
		
		// Check metadata object
		if (jsonData.metadata) {
			const metadata = jsonData.metadata as { totalMaps?: number; totalAchievements?: number };
			if (metadata.totalMaps !== undefined || metadata.totalAchievements !== undefined) {
				return {
					totalMaps: metadata.totalMaps,
					totalAchievements: metadata.totalAchievements,
				};
			}
		}
		
		return null;
	} catch (error) {
		console.error(`[NK API] Error fetching metadata:`, error);
		return null;
	}
}

export async function fetchPlayerData(nkId: string, retries = MAX_RETRIES): Promise<NKPlayerResponse | null> {
	const url = `${config.nk.apiBase}${nkId}`;

	for (let attempt = 0; attempt <= retries; attempt++) {
		try {
			const response = await fetch(url, {
				method: "GET",
				headers: {
					"Accept": "application/json",
					"User-Agent": "BTD6-Role-Bot/1.0",
				},
			});

			const contentType = response.headers.get("content-type");
			if (!contentType || !contentType.includes("application/json")) {
				const text = await response.text();
				console.error(`[NK API] Non-JSON response: ${text.substring(0, 200)}`);
				return null;
			}

			const jsonData = await response.json() as NKAPIResponse;
			
			// NK API returns HTTP 200 even for errors, check JSON for success/error
			if (jsonData.success === false || (jsonData.error && jsonData.error !== null)) {
				console.log(`[NK API] API error: ${jsonData.error || "Unknown error"}`);
				return null;
			}

			// Log full response structure for debugging
			// Check if this is the first successful fetch to log structure
			if (process.env.DEBUG_API === "true" || !(globalThis as any).__NK_API_LOGGED) {
				console.log(`[NK API] Full response keys:`, Object.keys(jsonData));
				console.log(`[NK API] Response structure (first 1000 chars):`, JSON.stringify(jsonData, null, 2).substring(0, 1000));
				(globalThis as any).__NK_API_LOGGED = true;
			}

			// NK API wraps successful responses in a "body" field
			if (jsonData.success === true && jsonData.body) {
				const data = jsonData.body as NKPlayerResponse;
				
				// Log if we find metadata fields (for debugging)
				if (jsonData.totalMaps !== undefined || jsonData.totalAchievements !== undefined) {
					console.log(`[NK API] Found metadata in response: totalMaps=${jsonData.totalMaps}, totalAchievements=${jsonData.totalAchievements}`);
				}
				
				// Check if achievements field shows "unlocked/total" format or has total info
				if (data.achievements !== undefined) {
					// Check if it's an object with unlocked/total instead of just a number
					if (typeof data.achievements === 'object' && data.achievements !== null) {
						const achObj = data.achievements as any;
						if (achObj.unlocked !== undefined || achObj.total !== undefined) {
							console.log(`[NK API] Achievements object found:`, achObj);
						}
					}
				}
				
				// Log all top-level keys in the wrapper to see what else is available
				const wrapperKeys = Object.keys(jsonData).filter(k => k !== 'body' && k !== 'success' && k !== 'error');
				if (wrapperKeys.length > 0) {
					console.log(`[NK API] Additional wrapper fields:`, wrapperKeys);
					wrapperKeys.forEach(key => {
						console.log(`[NK API]   ${key}:`, typeof jsonData[key], Array.isArray(jsonData[key]) ? `[array length ${(jsonData[key] as any[]).length}]` : '');
					});
				}
				
				console.log(`[NK API] Successfully fetched player data`);
				return data;
			}

			// Fallback: try to use data directly if no body wrapper
			if ((jsonData as any).displayName || (jsonData as any).stats) {
				const data = jsonData as unknown as NKPlayerResponse;
				console.log(`[NK API] Successfully fetched player data (direct format)`);
				return data;
			}

			console.error(`[NK API] Unexpected response format`);
			return null;
		} catch (error) {
			if (attempt === retries) {
				console.error(`[NK API] Failed to fetch player data after ${retries + 1} attempts:`, error);
				return null;
			}
			await sleep(RETRY_DELAY * (attempt + 1));
		}
	}

	return null;
}

