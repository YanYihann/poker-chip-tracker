import { PrismaClient } from "@prisma/client";
const globalWithPrisma = globalThis;
export const prisma = globalWithPrisma.prisma ??
    new PrismaClient({
        log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
    });
if (process.env.NODE_ENV !== "production") {
    globalWithPrisma.prisma = prisma;
}
