import "server-only";
import { prisma } from "@/lib/prisma";
import type { RemoteTemplate } from "@/lib/gupshup";

// Upserts templates fetched from Gupshup and marks missing ones as deleted.
export async function storeTemplates(appId: string, remote: RemoteTemplate[]) {
  const fields = (t: RemoteTemplate) => ({
    elementName: t.elementName,
    languageCode: t.languageCode,
    category: t.category,
    status: t.status,
    templateType: t.templateType,
    body: t.body,
    header: t.header,
    footer: t.footer,
    buttons: (t.buttons as object) ?? undefined,
    paramCount: t.paramCount,
    sampleMediaUrl: t.sampleMediaUrl,
    reason: t.reason,
    raw: t.raw as object,
  });
  await prisma.$transaction([
    ...remote.map((t) =>
      prisma.template.upsert({
        where: { appId_gupshupId: { appId, gupshupId: t.id } },
        create: { appId, gupshupId: t.id, ...fields(t) },
        update: fields(t),
      }),
    ),
    // Templates deleted in Gupshup are marked, not removed, so history stays intact.
    prisma.template.updateMany({ where: { appId, gupshupId: { notIn: remote.map((t) => t.id) } }, data: { status: "DELETED" } }),
    prisma.app.update({
      where: { id: appId },
      data: { templatesSyncedAt: new Date(), keyVerifiedAt: new Date(), lastSyncError: null },
    }),
  ]);
}

