import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
	if (!prisma) {
		prisma = new PrismaClient({
			log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
		});
	}
	return prisma;
}

export async function disconnectPrisma(): Promise<void> {
	if (prisma) {
		await prisma.$disconnect();
		prisma = null;
	}
}

// Graceful shutdown handler
process.on("SIGINT", async () => {
	await disconnectPrisma();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await disconnectPrisma();
	process.exit(0);
});

