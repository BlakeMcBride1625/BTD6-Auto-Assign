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

import type { NKPlayerResponse } from "../nk/types.js";

/**
 * Checks if a BTD6 account has been flagged by Ninja Kiwi (green leaf flag).
 * An account is flagged if either the `cheater` or `modded` field is true.
 * 
 * @param playerData - The player data from the Ninja Kiwi API
 * @returns true if the account is flagged, false otherwise
 */
export function isAccountFlagged(playerData: NKPlayerResponse): boolean {
	return playerData.cheater === true || playerData.modded === true;
}

