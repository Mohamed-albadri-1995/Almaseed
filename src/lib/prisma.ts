import { PrismaClient } from '@prisma/client';

// Transcripts can be ~60KB of text per hour of recording. Keep them (and their
// search copy) out of every material query by default — lists, cards, feeds,
// sitemaps — and opt in only where shown or searched
// (`omit: { transcript: false }`).
function makeClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    omit: { material: { transcript: true, transcriptSearch: true } },
  });
}

// Reuse a single PrismaClient across hot-reloads in development.
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof makeClient> | undefined;
};

export const prisma = globalForPrisma.prisma ?? makeClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
