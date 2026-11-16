import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { syncAllTemplatesAction } from "@/app/actions/accounts";
import { ActionForm } from "@/components/action-form";
import { TemplateCard } from "@/components/template-card";
import { Empty, PageHeader } from "@/components/ui";
import type { Prisma } from "@/generated/prisma/client";

export const metadata = { title: "Templates" };

export default async function TemplatesPage({ searchParams }: PageProps<"/templates">) {
  const sp = await searchParams;
  const user = await requireUser();
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const appId = str("app");
  const show = str("show") || "approved";
  const q = str("q").trim();

  const apps = await prisma.app.findMany({ where: appWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  const where: Prisma.TemplateWhereInput = {
    app: appWhere(user),
    status: show === "approved" ? "APPROVED" : { notIn: ["DELETED"] },
    ...(appId ? { appId } : {}),
    ...(q ? { OR: [{ elementName: { contains: q, mode: "insensitive" } }, { body: { contains: q, mode: "insensitive" } }] } : {}),
  };
  const [templates, counts] = await Promise.all([
    prisma.template.findMany({ where, include: { app: { select: { name: true } } }, orderBy: [{ status: "asc" }, { elementName: "asc" }], take: 200 }),
    prisma.template.groupBy({ by: ["status"], where: { app: appWhere(user), status: { not: "DELETED" } }, _count: true }),
  ]);
  const approvedCount = counts.find((c) => c.status === "APPROVED")?._count ?? 0;
  const allCount = counts.reduce((n, c) => n + c._count, 0);
  const link = (o: Record<string, string>) => {
    const p = new URLSearchParams({ ...(appId ? { app: appId } : {}), ...(q ? { q } : {}), show, ...o });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `?${p.toString()}`;
  };

  return (
    <>
      <PageHeader
        title="Templates"
        description="Messages approved by WhatsApp. Create or edit them in Gupshup, then sync."
        actions={
          apps.length ? (
            <ActionForm action={syncAllTemplatesAction} submit="Sync all from Gupshup" pendingLabel="Syncing..." submitClass="btn-secondary" className="" inlineAlerts={false}>
              {null}
            </ActionForm>
          ) : null
        }
      />
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
            <form className="flex gap-2" action="/templates">
              <input type="hidden" name="show" value={show} />
              {apps.length > 1 ? (
                <select name="app" defaultValue={appId} className="input w-40">
                  <option value="">All numbers</option>
                  {apps.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              ) : null}
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
