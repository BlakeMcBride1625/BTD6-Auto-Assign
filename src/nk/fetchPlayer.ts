import config from "../config/config.js";
import type { NKPlayerResponse } from "./types.js";

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

async function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
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

			const jsonData = await response.json() as any;
			
			// NK API returns HTTP 200 even for errors, check JSON for success/error
			if (jsonData.success === false || (jsonData.error && jsonData.error !== null)) {
				console.log(`[NK API] API error: ${jsonData.error || "Unknown error"}`);
				return null;
			}

			// NK API wraps successful responses in a "body" field
			if (jsonData.success === true && jsonData.body) {
				const data = jsonData.body as NKPlayerResponse;
				console.log(`[NK API] Successfully fetched player data`);
				return data;
			}

			// Fallback: try to use data directly if no body wrapper
			if (jsonData.displayName || jsonData.stats) {
				const data = jsonData as NKPlayerResponse;
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

