import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { accountWhere, isAdmin, requireUser } from "@/lib/access";
import { Badge, Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Accounts & apps" };

export default async function AccountsPage() {
  const user = await requireUser();
  const accounts = await prisma.gupshupAccount.findMany({
    where: accountWhere(user),
    include: {
      owner: { select: { name: true } },
      apps: { select: { id: true, name: true, sourceNumber: true, active: true, _count: { select: { templates: { where: { status: "APPROVED" } } } } }, orderBy: { name: "asc" } },
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="Accounts & apps"
        description="Each Gupshup account holds one or more WhatsApp apps. Each app has its own API key, webhook and templates."
        actions={<Link href="/accounts/new" className="btn-primary">Add account</Link>}
      />
      {accounts.length === 0 ? (
        <Empty title="No accounts yet">
          {isAdmin(user) ? "Add a Gupshup account to get started." : "Add your Gupshup account, or ask your admin to give you access."}
        </Empty>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((a) => (
            <div key={a.id} className="card flex flex-col">
              <Link href={`/accounts/${a.id}`} className="block border-b border-gray-100 px-4 py-3 hover:bg-gray-50 sm:px-5">
                <p className="font-semibold text-gray-900">{a.name}</p>
                <p className="text-xs text-gray-500">
                  {a.apps.length} app{a.apps.length === 1 ? "" : "s"}
                  {isAdmin(user) ? ` · owner ${a.owner.name}` : ""}
                </p>
              </Link>
              <ul className="flex-1 divide-y divide-gray-100">
                {a.apps.map((app) => (
                  <li key={app.id}>
                    <Link href={`/apps/${app.id}`} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm hover:bg-gray-50 sm:px-5">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-800">{app.name}</span>
                        <span className="block text-xs text-gray-500">+{app.sourceNumber} · {app._count.templates} approved templates</span>
                      </span>
                      {!app.active ? <Badge value="DISABLED" /> : null}
                    </Link>
                  </li>
                ))}
                {a.apps.length === 0 ? <li className="px-4 py-3 text-sm text-gray-500 sm:px-5">No apps yet.</li> : null}
              </ul>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
