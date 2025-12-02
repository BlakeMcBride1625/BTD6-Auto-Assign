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

