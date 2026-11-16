"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { appWhere, getAccessibleApp, requireUser, type SessionUser } from "@/lib/access";
import { parseRecipients, type BadRow } from "@/lib/excel";
import { getOrigin } from "@/lib/origin";
import { isStalled, kickCampaign } from "@/lib/worker";
import { renderPreviewText } from "@/lib/template-vars";

export type UploadState =
  | { error?: string; bad?: BadRow[]; goodCount?: number; overLimit?: boolean }
  | undefined;

const MAX_BYTES = 4 * 1024 * 1024;

export async function uploadBulkAction(_: UploadState, form: FormData): Promise<UploadState> {
  const user = await requireUser();
  const app = await getAccessibleApp(user, String(form.get("appId") ?? ""));
  if (!app.active) return { error: "This WhatsApp number is turned off. Turn it on in its Settings." };
  const template = await prisma.template.findFirst({
    where: { id: String(form.get("templateId") ?? ""), appId: app.id, status: "APPROVED" },
  });
  if (!template) return { error: "Pick an approved template." };

  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an Excel file (.xlsx)." };
  if (file.size > MAX_BYTES) return { error: "File is larger than 4 MB. Split it into smaller files." };
  if (!file.name.toLowerCase().endsWith(".xlsx")) return { error: "Only .xlsx files are supported. In Excel, use Save As, Excel Workbook." };

  let parsed;
  try {
    parsed = await parseRecipients(await file.arrayBuffer(), template);
  } catch (e) {
    return { error: (e as Error).message || "Could not read the file." };
  }
  const { good, bad, overLimit } = parsed;
  if (good.length === 0) {
    return { error: "No valid rows found.", bad: bad.slice(0, 500), goodCount: 0, overLimit };
  }

  const name = String(form.get("name") ?? "").trim() || `${template.elementName} ${new Date().toLocaleDateString("en-IN")}`;
  const campaign = await prisma.campaign.create({
    data: {
      name,
      appId: app.id,
      templateId: template.id,
      createdById: user.id,
      status: "DRAFT",
      total: good.length,
      fileName: file.name,
      skippedRows: bad.length ? (bad.slice(0, 2000) as object[]) : undefined,
    },
  });
  for (let i = 0; i < good.length; i += 1000) {
    await prisma.message.createMany({
      data: good.slice(i, i + 1000).map((r) => ({
        appId: app.id,
        campaignId: campaign.id,
        templateId: template.id,
        sentById: user.id,
        direction: "OUTBOUND" as const,
        phone: r.phone,
        status: "QUEUED" as const,
        type: "template",
        params: r.params,
        text: renderPreviewText(template, r.params),
        mediaUrl: r.mediaUrl,
        rowNumber: r.row,
      })),
    });
  }
  redirect(`/campaigns/${campaign.id}`);
}

async function ownCampaign(user: SessionUser, id: string) {
  const c = await prisma.campaign.findFirst({ where: { id, app: appWhere(user) } });
  if (!c) throw new Error("Campaign not found");
  return c;
}

async function kickLater(id: string) {
  const origin = await getOrigin();
  after(() => kickCampaign(origin, id));
}

export async function startCampaignAction(form: FormData) {
  const user = await requireUser();
  const c = await ownCampaign(user, String(form.get("id")));
  if (c.status !== "DRAFT" && c.status !== "PAUSED") return;
  await prisma.campaign.update({
    where: { id: c.id },
    data: { status: "RUNNING", startedAt: c.startedAt ?? new Date(), lastTickAt: new Date() },
  });
  await kickLater(c.id);
  revalidatePath(`/campaigns/${c.id}`);
}

export async function pauseCampaignAction(form: FormData) {
  const user = await requireUser();
  const c = await ownCampaign(user, String(form.get("id")));
  if (c.status !== "RUNNING") return;
  await prisma.campaign.update({ where: { id: c.id }, data: { status: "PAUSED" } });
  revalidatePath(`/campaigns/${c.id}`);
}

export async function cancelCampaignAction(form: FormData) {
  const user = await requireUser();
  const c = await ownCampaign(user, String(form.get("id")));
  if (c.status === "COMPLETED" || c.status === "CANCELLED") return;
  if (c.status === "DRAFT") {
    await prisma.campaign.delete({ where: { id: c.id } });
    redirect("/campaigns");
  }
  await prisma.$transaction([
    prisma.campaign.update({ where: { id: c.id }, data: { status: "CANCELLED", completedAt: new Date() } }),
    prisma.message.updateMany({
      where: { campaignId: c.id, status: "QUEUED" },
      data: { status: "FAILED", error: "Cancelled before sending", failedAt: new Date() },
    }),
  ]);
  revalidatePath(`/campaigns/${c.id}`);
}

// Restarts a running campaign whose chain of worker calls stopped.
export async function resumeStalledAction(form: FormData) {
  const user = await requireUser();
  const c = await ownCampaign(user, String(form.get("id")));
  if (c.status === "RUNNING") await kickLater(c.id);
  revalidatePath(`/campaigns/${c.id}`);
}

export async function campaignProgress(id: string) {
  const user = await requireUser();
  const c = await prisma.campaign.findFirst({
    where: { id, app: appWhere(user) },
    select: { id: true, status: true, total: true, lastTickAt: true, leaseUntil: true },
  });
  if (!c) return null;
  const groups = await prisma.message.groupBy({ by: ["status"], where: { campaignId: id }, _count: true });
  const counts = Object.fromEntries(groups.map((g) => [g.status, g._count]));
  // Self-heal: if the chain stalled, start it again when someone is watching.
  if (isStalled(c)) await kickLater(c.id);
  return { status: c.status, total: c.total, counts, stalled: isStalled(c) };
}
