export function validateNKID(nkId: string): boolean {
	if (!nkId || typeof nkId !== "string") {
		return false;
	}

	// NKIDs are typically alphanumeric strings
	// Adjust this regex based on actual NKID format
	const nkIdRegex = /^[a-zA-Z0-9_-]+$/;
	return nkIdRegex.test(nkId.trim()) && nkId.trim().length > 0;
}

export function sanitizeNKID(nkId: string): string {
	return nkId.trim();
}

export function sanitizeInput(input: string): string {
	return input.trim().slice(0, 1000); // Limit length
}

