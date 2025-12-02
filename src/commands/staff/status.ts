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

import {
	ChatInputCommandInteraction,
	SlashCommandBuilder,
} from "discord.js";
import { isOwner } from "../../utils/permissions.js";
import { createSuccessEmbed, createErrorEmbed } from "../../utils/embeds.js";
import config from "../../config/config.js";

export const data = new SlashCommandBuilder()
	.setName("status")
	.setDescription("Check API status and response times (Owner only)");

interface ApiStatus {
	online: boolean;
	ping: number | null;
	status: string;
	error?: string;
}

async function checkEpildevConnectApi(apiKey: string): Promise<ApiStatus> {
	const startTime = Date.now();
	
	try {
		const url = `https://api.epildevconnect.uk/api/btd6/validate`;
		const response = await fetch(`${url}?key=${encodeURIComponent(apiKey)}`, {
			method: "GET",
			headers: {
				"Accept": "application/json",
			},
			signal: AbortSignal.timeout(10000), // 10 second timeout
		});

		const endTime = Date.now();
		const ping = endTime - startTime;

		if (!response.ok) {
			return {
				online: false,
				ping: ping,
				status: "Invalid",
				error: `HTTP ${response.status}`,
			};
		}

		const data = await response.json() as { valid?: boolean };
		const isValid = data.valid === true;

		return {
			online: true,
			ping: ping,
			status: isValid ? "Valid" : "Invalid",
			error: isValid ? undefined : "API key validation failed",
		};
	} catch (error) {
		const endTime = Date.now();
		const ping = endTime - startTime;

		if (error instanceof Error && error.name === "AbortError") {
			return {
				online: false,
				ping: ping,
				status: "Timeout",
				error: "Request timed out after 10 seconds",
			};
		}

		return {
			online: false,
			ping: ping,
			status: "Error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

async function checkNinjaKiwiApi(apiBase: string): Promise<ApiStatus> {
	const startTime = Date.now();
	
	// Test with a simple request to check API connectivity
	// Use a minimal OAK-like string to test (NK API will return an error but confirms API is reachable)
	// Or we can use HEAD request to just check connectivity
	const testUrl = apiBase.endsWith("/") ? `${apiBase}test-connectivity-check` : `${apiBase}/test-connectivity-check`;
	
	try {
		const response = await fetch(testUrl, {
			method: "GET",
			headers: {
				"Accept": "application/json",
				"User-Agent": "BTD6-Role-Bot/1.0",
			},
			signal: AbortSignal.timeout(10000), // 10 second timeout
		});

		const endTime = Date.now();
		const ping = endTime - startTime;

		// Any response (even 404 or error) means the API server is reachable
		// If we get a response, the API is online (even if it's an error response)
		// This confirms the server is reachable and responding
		if (response.status < 500) {
			// Any status < 500 means the server is responding (even if it's a 404 or 400)
			return {
				online: true,
				ping: ping,
				status: response.ok ? "Online" : `HTTP ${response.status}`,
			};
		}

		// 5xx errors might indicate server issues, but still consider it "online" (server responding)
		return {
			online: true,
			ping: ping,
			status: `HTTP ${response.status}`,
			error: "Server error response",
		};
	} catch (error) {
		const endTime = Date.now();
		const ping = endTime - startTime;

		if (error instanceof Error && error.name === "AbortError") {
			return {
				online: false,
				ping: ping,
				status: "Timeout",
				error: "Request timed out after 10 seconds",
			};
		}

		// Check if it's a network error (API might be down)
		if (error instanceof Error && (error.message.includes("fetch") || error.message.includes("network") || error.message.includes("ECONNREFUSED"))) {
			return {
				online: false,
				ping: null,
				status: "Offline",
				error: "Network error - API unreachable",
			};
		}

		return {
			online: false,
			ping: ping,
			status: "Error",
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
	await interaction.deferReply({ ephemeral: true });

	// Check owner permission
	if (!isOwner(interaction.user.id)) {
		await interaction.editReply({
			embeds: [createErrorEmbed("Permission Denied", "Only the bot owner can use this command.")],
		});
		return;
	}

	try {
		// Check both APIs concurrently
		const [epildevStatus, nkStatus] = await Promise.all([
			checkEpildevConnectApi(config.api.key),
			checkNinjaKiwiApi(config.nk.apiBase),
		]);

		// Determine overall status
		const allOnline = epildevStatus.online && nkStatus.online;
		const embed = allOnline
			? createSuccessEmbed("API Status", "All APIs are operational.")
			: createErrorEmbed("API Status", "One or more APIs are experiencing issues.");

		// EpildevConnect API Status
		const epildevIndicator = epildevStatus.online ? "✅" : "❌";
		const epildevPing = epildevStatus.ping !== null ? `${epildevStatus.ping}ms` : "N/A";
		
		embed.addFields({
			name: `${epildevIndicator} EpildevConnect API`,
			value: [
				`**Status:** ${epildevStatus.online ? "Online" : "Offline"}`,
				`**Ping:** ${epildevPing}`,
				`**API Key:** ${epildevStatus.status}`,
				`**Endpoint:** \`https://api.epildevconnect.uk/api/btd6/validate\``,
				epildevStatus.error ? `**Error:** ${epildevStatus.error}` : "",
			].filter(Boolean).join("\n"),
			inline: false,
		});

		// Ninja Kiwi API Status
		const nkIndicator = nkStatus.online ? "✅" : "❌";
		const nkPing = nkStatus.ping !== null ? `${nkStatus.ping}ms` : "N/A";
		
		embed.addFields({
			name: `${nkIndicator} Ninja Kiwi API`,
			value: [
				`**Status:** ${nkStatus.online ? "Online" : "Offline"}`,
				`**Ping:** ${nkPing}`,
				`**Base URL:** \`${config.nk.apiBase}\``,
				nkStatus.error ? `**Error:** ${nkStatus.error}` : "",
			].filter(Boolean).join("\n"),
			inline: false,
		});

		// Overall Summary
		const summaryText = allOnline
			? "All systems operational. Both APIs are responding normally."
			: "Some APIs are experiencing issues. Please check the details above.";

		embed.addFields({
			name: "Summary",
			value: summaryText,
			inline: false,
		});

		await interaction.editReply({ embeds: [embed] });
	} catch (error) {
		console.error("Error checking API status:", error);
		await interaction.editReply({
			embeds: [
				createErrorEmbed(
					"Error",
					"An error occurred whilst checking API status. Please try again later.",
				),
			],
		});
	}
}

