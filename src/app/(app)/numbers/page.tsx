import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { accountWhere, isAdmin, requireUser } from "@/lib/access";
import { formatPhone } from "@/lib/phone";
import { PageHeader } from "@/components/ui";
import { ReadinessChips } from "@/components/readiness";

export const metadata = { title: "WhatsApp numbers" };

export default async function NumbersPage() {
  const user = await requireUser();
  const accounts = await prisma.gupshupAccount.findMany({
    where: accountWhere(user),
    include: {
      owner: { select: { name: true } },
      apps: {
        orderBy: { name: "asc" },
        include: { _count: { select: { templates: { where: { status: "APPROVED" } } } } },
      },
    },
    orderBy: { name: "asc" },
  });
  const total = accounts.reduce((n, a) => n + a.apps.length, 0);

  return (
    <>
      <PageHeader
        title="WhatsApp numbers"
        description="Each number is a Gupshup app. Numbers are grouped by the business (Gupshup account) they belong to."
        actions={<Link href="/numbers/new" className="btn-primary">+ Connect a number</Link>}
      />

      {total === 0 ? (
        <div className="card p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-gray-900">Connect your first WhatsApp number</h2>
          <p className="mt-1 text-sm text-gray-600">Keep the Gupshup dashboard open. You will copy four things from your Gupshup app:</p>
          <ol className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["App name", "Exactly as shown in Gupshup"],
              ["App ID", "Looks like 260dc464-fe34-..."],
              ["WhatsApp number", "With country code"],
              ["API key", "App, API Keys, Create API key"],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-lg border border-gray-200 p-3">
                <p className="text-xs font-semibold text-brand-700">{i + 1}</p>
                <p className="font-medium text-gray-900">{t}</p>
                <p className="text-xs text-gray-500">{d}</p>
              </li>
            ))}
          </ol>
          <Link href="/numbers/new" className="btn-primary mt-6">Start</Link>
        </div>
      ) : (
        <div className="space-y-6">
          {accounts.map((a) => (
            <section key={a.id}>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                  {a.name}
                  {isAdmin(user) ? <span className="ml-2 font-normal normal-case tracking-normal text-gray-400">owner {a.owner.name}</span> : null}
                </h2>
                <div className="flex gap-3 text-sm">
                  <Link href={`/numbers/new?account=${a.id}`} className="text-brand-700 hover:underline">+ Add number</Link>
                  <Link href={`/accounts/${a.id}`} className="text-gray-500 hover:text-gray-800">Business settings</Link>
                </div>
              </div>
              {a.apps.length === 0 ? (
                <p className="card px-4 py-3 text-sm text-gray-500">No numbers in this business yet.</p>
              ) : (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {a.apps.map((app) => (
                    <Link key={app.id} href={`/numbers/${app.id}`} className="card block p-4 transition hover:border-brand-500">
                      <p className="font-semibold text-gray-900">{app.name}</p>
                      <p className="mb-3 text-sm text-gray-500">{formatPhone(app.sourceNumber)}</p>
                      <ReadinessChips compact app={{ ...app, approvedCount: app._count.templates }} />
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}
    </>
  );
}
