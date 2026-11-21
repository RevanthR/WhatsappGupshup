import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { syncAllTemplatesAction } from "@/app/actions/accounts";
import { ActionForm } from "@/components/action-form";
import { TemplateCard } from "@/components/template-card";
import { Alert, Empty, PageHeader } from "@/components/ui";
import { PendingRefresh } from "@/components/pending-refresh";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Templates" };

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const sp = await searchParams;
  const user = await requireUser();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const appId = str("app");
  const show = str("show") || "approved";
  const q = str("q").trim();
  const type = ["TEXT", "IMAGE", "VIDEO", "DOCUMENT"].includes(str("type")) ? str("type") : "";

  const apps = await prisma.app.findMany({ where: appWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const where: Prisma.TemplateWhereInput = {
    app: appWhere(user),
    status: show === "approved" ? "APPROVED" : { notIn: ["DELETED"] },
    ...(appId ? { appId } : {}),
    ...(type ? { templateType: type } : {}),
    ...(q ? { OR: [{ elementName: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [templates, counts] = await Promise.all([
    prisma.template.findMany({ where, include: { app: { select: { name: true } } }, orderBy: [{ status: "asc" }, { elementName: "asc" }], take: 200 }),
    prisma.template.groupBy({ by: ["status"], where: { app: appWhere(user), status: { not: "DELETED" } }, _count: true }),
  ]);
  const pendingApps = [
    ...new Set(
      (await prisma.template.findMany({ where: { app: appWhere(user), status: "PENDING" }, select: { appId: true } })).map((t) => t.appId),
    ),
  ];
  const approvedCount = counts.find((c) => c.status === "APPROVED")?._count ?? 0;
  const allCount = counts.reduce((n, c) => n + c._count, 0);
  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(appId ? { app: appId } : {}), ...(q ? { q } : {}), ...(type ? { type } : {}), show, ...o });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Templates"
        description="Messages approved by WhatsApp. Create new ones here or in Gupshup."
        actions={
          apps.length ? (
            <>
              <ActionForm action={syncAllTemplatesAction} submit="Sync from Gupshup" pendingLabel="Syncing..." submitClass="btn-secondary" className="" inlineAlerts={false}>
                {null}
              </ActionForm>
              <Link href={appId ? `/templates/new?app=${appId}` : "/templates/new"} className="btn-primary">+ New template</Link>
            </>
          ) : null
        }
      />
      {str("submitted") ? (
        <div className="mb-4">
          <Alert tone="success">
            <b className="font-mono">{str("submitted")}</b> was sent to WhatsApp for review. It shows as Pending below and updates on its own, usually within minutes to a few hours.
          </Alert>
        </div>
      ) : null}
      {pendingApps.length ? <PendingRefresh appIds={pendingApps} /> : null}
      {apps.length === 0 ? (
        <Empty title="No WhatsApp numbers yet">
          <Link href="/numbers/new" className="font-medium text-brand-700 hover:underline">Connect a number</Link> to see its templates.
        </Empty>
      ) : (
        <>
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-1 text-sm">
              <Link href={link({ show: "approved" })} className={`rounded-full px-3 py-1 ${show === "approved" ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>Ready to send ({approvedCount})</Link>
              <Link href={link({ show: "all" })} className={`rounded-full px-3 py-1 ${show === "all" ? "bg-brand-600 text-white" : "bg-white text-gray-700 ring-1 ring-gray-200"}`}>All ({allCount})</Link>
            </div>
            <form className="flex flex-wrap gap-2 sm:flex-nowrap" action="/templates">
              <input type="hidden" name="show" value={show} />
              {apps.length > 1 ? (
                <select name="app" defaultValue={appId} className="input w-40">
                  <option value="">All numbers</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : null}
              <select name="type" defaultValue={type} className="input w-32">
                <option value="">Any type</option>
                <option value="TEXT">Text</option>
                <option value="IMAGE">Image</option>
                <option value="VIDEO">Video</option>
                <option value="DOCUMENT">Document</option>
              </select>
              <input name="q" defaultValue={q} placeholder="Search templates" className="input w-full sm:w-56" />
              <button className="btn-secondary">Go</button>
            </form>
          </div>
          {templates.length === 0 ? (
            <Empty title={show === "approved" ? "No approved templates match" : "No templates match"}>
              {show === "approved" ? <Link href={link({ show: "all" })} className="text-brand-700 hover:underline">Show all statuses</Link> : "Try another search."}
            </Empty>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {templates.map((t) => <TemplateCard key={t.id} t={t} numberName={apps.length > 1 ? t.app.name : undefined} />)}
            </div>
          )}
        </>
      )}
    </>
  );
}
