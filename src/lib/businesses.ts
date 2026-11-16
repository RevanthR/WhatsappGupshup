import "server-only";
import { prisma } from "@/lib/prisma";
import { formatPhone } from "@/lib/phone";

// Businesses (Gupshup accounts) with their numbers, for access pickers.
export async function listBusinesses() {
  const rows = await prisma.gupshupAccount.findMany({
    select: { id: true, name: true, apps: { select: { name: true, sourceNumber: true }, orderBy: { name: "asc" } } },
    orderBy: { name: "asc" },
  });
  return rows.map((r) => ({ id: r.id, name: r.name, numbers: r.apps.map((a) => `${a.name} ${formatPhone(a.sourceNumber)}`) }));
}
