import { User, Message, EmbedBuilder } from "discord.js";

// Store messages to be deleted: messageId -> timeout
const scheduledDeletions = new Map<string, NodeJS.Timeout>();

const DELETE_AFTER_MS = 12 * 60 * 60 * 1000; // 12 hours in milliseconds

/**
 * Send a DM to a user and schedule it for automatic deletion after 12 hours
 */
export async function sendDMWithAutoDelete(
	user: User,
	embeds: EmbedBuilder[],
): Promise<Message | null> {
	try {
		const message = await user.send({ embeds });
		
		// Schedule deletion after 12 hours
		const timeout = setTimeout(async () => {
			try {
				await message.delete();
				scheduledDeletions.delete(message.id);
			} catch (error) {
				// Message might already be deleted by user, or bot doesn't have permission
				// That's okay, just clean up the timeout
				scheduledDeletions.delete(message.id);
			}
		}, DELETE_AFTER_MS);

		scheduledDeletions.set(message.id, timeout);
		return message;
	} catch (error) {
		// User might have DMs disabled
		throw error;
	}
}

/**
 * Cancel scheduled deletion for a message (if user deletes it manually)
 */
export function cancelScheduledDeletion(messageId: string): void {
	const timeout = scheduledDeletions.get(messageId);
	if (timeout) {
		clearTimeout(timeout);
		scheduledDeletions.delete(messageId);
	}
}

/**
 * Clean up all scheduled deletions (for graceful shutdown)
 */
export function cleanupScheduledDeletions(): void {
	for (const timeout of scheduledDeletions.values()) {
		clearTimeout(timeout);
	}
	scheduledDeletions.clear();
}

