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

export function validateOAK(oak: string): boolean {
	if (!oak || typeof oak !== "string") {
		return false;
	}

	// OAKs are typically alphanumeric strings
	// Adjust this regex based on actual OAK format
	const oakRegex = /^[a-zA-Z0-9_-]+$/;
	return oakRegex.test(oak.trim()) && oak.trim().length > 0;
}

export function sanitizeOAK(oak: string): string {
	return oak.trim();
}

export function sanitizeInput(input: string): string {
	return input.trim().slice(0, 1000); // Limit length
}

