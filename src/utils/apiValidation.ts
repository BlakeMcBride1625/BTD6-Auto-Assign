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

import { logger } from "./logger.js";

const API_BASE_URL = "https://api.epildevconnect.uk";
const PROJECT_SLUG = "btd6";

/**
 * Validate an API key against the API management system.
 * Returns true if valid, false otherwise.
 * Exits the process if the API key is missing or invalid.
 */
export async function validateApiKey(apiKey: string | undefined): Promise<boolean> {
	if (!apiKey) {
		logger.error("BTD6_API_KEY environment variable is not set!", false);
		logger.error("Bot cannot start without a valid API key.", false);
		logger.error("Please set BTD6_API_KEY in your .env file.", false);
		process.exit(1);
	}

	try {
		const url = `${API_BASE_URL}/api/${PROJECT_SLUG}/validate`;
		const response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
			method: "GET",
			headers: {
				"Accept": "application/json",
			},
			signal: AbortSignal.timeout(10000), // 10 second timeout
		});

		if (!response.ok) {
			logger.error(`API validation failed: HTTP ${response.status}`, false);
			logger.error("Bot cannot start without a valid API key.", false);
			process.exit(1);
		}

		const data = await response.json() as { valid?: boolean };
		const isValid = data.valid === true;

		if (!isValid) {
			logger.error("Invalid API key! Bot cannot start.", false);
			logger.error("Please check your API key or generate a new one via Discord bot.", false);
			process.exit(1);
		}

	logger.info("✅ API key validated successfully", false);
	return true;
} catch (error) {
	if (error instanceof Error && error.name === "AbortError") {
		logger.error("API validation request timed out", false);
	} else {
		logger.error(`Failed to validate API key: ${error}`, false);
	}
	logger.error("Bot cannot start without API key validation.", false);
	process.exit(1);
}
}

/**
 * Check if the API key is currently valid (non-blocking, returns boolean).
 * This function does NOT exit the process - use for runtime checks.
 * Returns true if valid, false otherwise.
 */
export async function checkApiKeyValid(apiKey: string | undefined): Promise<boolean> {
	if (!apiKey) {
		return false;
	}

	try {
		const url = `${API_BASE_URL}/api/${PROJECT_SLUG}/validate`;
		const response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
			method: "GET",
			headers: {
				"Accept": "application/json",
			},
			signal: AbortSignal.timeout(5000), // 5 second timeout for runtime checks
		});

		if (!response.ok) {
			return false;
		}

		const data = await response.json() as { valid?: boolean };
		return data.valid === true;
	} catch (error) {
		// Log error but don't exit - this is a runtime check
		logger.error(`API validation check failed: ${error}`, false);
		return false;
	}
}

