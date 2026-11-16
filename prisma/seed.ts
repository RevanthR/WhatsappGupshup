import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// Creates (or resets) the super admin from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

async function main() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const name = process.env.SEED_ADMIN_NAME ?? "Super Admin";
  if (!email || !password) throw new Error("Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD");
  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.upsert({
    where: { email },
    create: { email, name, passwordHash, role: "SUPER_ADMIN", mustChangePassword: false },
    update: { passwordHash, role: "SUPER_ADMIN", active: true },
  });
  console.log(`Super admin ready: ${email}`);
}

main().finally(() => prisma.$disconnect());
