import { PrismaClient } from "@prisma/client";

// Mencegah Next.js membuat ribuan koneksi database saat kita sering save file (Hot Reload)
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;