// lib/prisma.js

import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis;

// Prevent multiple instances of PrismaClient in development (hot-reloading)
const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'], // You can remove or adjust this for production
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
