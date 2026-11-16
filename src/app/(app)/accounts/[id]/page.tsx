import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleAccount, isAdmin, requireUser } from "@/lib/access";
import { formatPhone } from "@/lib/phone";
import { deleteAccountAction, setAccountAccessAction, updateAccountAction } from "@/app/actions/accounts";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { ReadinessChips } from "@/components/readiness";
import { Badge, Card, PageHeader } from "@/components/ui";

export default async function AccountPage({ params }: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const account = await getAccessibleAccount(user, id);
  const [apps, access, users] = await Promise.all([
    prisma.app.findMany({
      where: { accountId: id },
      include: { _count: { select: { templates: { where: { status: "APPROVED" } } } } },
      orderBy: { name: "asc" },
    }),
    prisma.accountAccess.findMany({ where: { accountId: id }, include: { user: { select: { id: true, name: true, email: true, role: true } } } }),
    isAdmin(user)
      ? prisma.user.findMany({ where: { role: "USER" }, select: { id: true, name: true, email: true, active: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const accessIds = new Set(access.map((a) => a.userId));
  const canDelete = isAdmin(user) || account.ownerId === user.id;

  return (
    <>
      <PageHeader
        title={account.name}
        description={<>Business (Gupshup account) · <Link href="/numbers" className="text-brand-700 hover:underline">All numbers</Link></>}
        actions={<Link href={`/numbers/new?account=${account.id}`} className="btn-primary">+ Add number</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title={`WhatsApp numbers (${apps.length})`}>
            {apps.length === 0 ? (
              <p className="text-sm text-gray-500">
                No numbers yet. <Link href={`/numbers/new?account=${account.id}`} className="text-brand-700 hover:underline">Connect one</Link>.
              </p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {apps.map((app) => (
                  <li key={app.id}>
                    <Link href={`/numbers/${app.id}`} className="flex flex-col gap-2 py-3 hover:opacity-80 sm:flex-row sm:items-center sm:justify-between">
                      <span>
                        <span className="block font-medium text-gray-900">{app.name}</span>
                        <span className="text-xs text-gray-500">{formatPhone(app.sourceNumber)}</span>
                      </span>
                      <ReadinessChips compact app={{ ...app, approvedCount: app._count.templates }} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="People with access">
            {isAdmin(user) ? (
              <ActionForm action={setAccountAccessAction} submit="Save access">
                <input type="hidden" name="id" value={account.id} />
                <p className="text-sm text-gray-600">Ticked users can send from every number in this business. Super admins always have access.</p>
                {users.length === 0 ? (
                  <p className="text-sm text-gray-500">No users yet. <Link href="/users" className="text-brand-700 hover:underline">Add users</Link>.</p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {users.map((u) => (
                      <label key={u.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <input type="checkbox" name="userIds" value={u.id} defaultChecked={accessIds.has(u.id)} className="h-4 w-4 accent-brand-600" />
                        <span className="min-w-0">
                          <span className="block truncate font-medium text-gray-900">{u.name}</span>
                          <span className="block truncate text-xs text-gray-500">{u.email}</span>
                        </span>
                        {!u.active ? <Badge value="DISABLED" /> : null}
                      </label>
                    ))}
                  </div>
                )}
                <div>
                  <label className="label" htmlFor="ownerId">Owner</label>
                  <select id="ownerId" name="ownerId" defaultValue={account.ownerId} className="input sm:w-72">
                    {[...access.map((a) => a.user), ...users.filter((u) => !accessIds.has(u.id))]
                      .filter((u, i, arr) => arr.findIndex((x) => x.id === u.id) === i)
                      .map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                  <p className="hint">The owner can delete this business.</p>
                </div>
              </ActionForm>
            ) : (
              <ul className="space-y-1 text-sm">
                {access.map((a) => <li key={a.userId}>{a.user.name} <span className="text-gray-500">{a.user.email}</span></li>)}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Details">
            <ActionForm action={updateAccountAction}>
              <input type="hidden" name="id" value={account.id} />
              <div>
                <label className="label" htmlFor="name">Business name</label>
                <input id="name" name="name" defaultValue={account.name} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={3} defaultValue={account.notes ?? ""} className="input" placeholder="Gupshup login email, billing contact..." />
              </div>
            </ActionForm>
          </Card>
          {canDelete ? (
            <Card title="Delete business">
              <p className="mb-3 text-sm text-gray-600">Removes all its numbers, templates, campaigns and history from WA Sender. Nothing changes in Gupshup.</p>
              <ConfirmButton action={deleteAccountAction} fields={{ id: account.id }} label="Delete business" confirm="Delete everything?" />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
