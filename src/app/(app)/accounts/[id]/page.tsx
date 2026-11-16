import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleAccount, isAdmin, requireUser } from "@/lib/access";
import {
  createAppAction,
  deleteAccountAction,
  setAccountAccessAction,
  updateAccountAction,
} from "@/app/actions/accounts";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { Badge, Card, PageHeader } from "@/components/ui";
import { AppFields } from "@/components/app-fields";

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
    prisma.accountAccess.findMany({ where: { accountId: id }, select: { userId: true } }),
    isAdmin(user)
      ? prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, active: true }, orderBy: { name: "asc" } })
      : Promise.resolve([]),
  ]);
  const accessIds = new Set(access.map((a) => a.userId));
  const canDelete = isAdmin(user) || account.ownerId === user.id;

  return (
    <>
      <PageHeader
        title={account.name}
        description={<Link href="/accounts" className="text-brand-700 hover:underline">All accounts</Link>}
      />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Apps">
            {apps.length === 0 ? (
              <p className="text-sm text-gray-500">No apps yet. Add the first one below.</p>
            ) : (
              <ul className="-my-2 divide-y divide-gray-100">
                {apps.map((app) => (
                  <li key={app.id}>
                    <Link href={`/apps/${app.id}`} className="flex items-center justify-between gap-3 py-3 hover:opacity-80">
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-gray-900">{app.name}</span>
                        <span className="block text-xs text-gray-500">
                          {app.gupshupAppName} · +{app.sourceNumber} · {app._count.templates} approved templates
                        </span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        {!app.active ? <Badge value="DISABLED" /> : null}
                        {app.lastWebhookAt ? <Badge value="ACTIVE" label="Webhook live" /> : <Badge value="PENDING" label="No webhook yet" />}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card title="Add app">
            <ActionForm action={createAppAction} submit="Add app" pendingLabel="Adding and syncing templates...">
              <input type="hidden" name="accountId" value={account.id} />
              <AppFields requireKey />
            </ActionForm>
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Account details">
            <ActionForm action={updateAccountAction}>
              <input type="hidden" name="id" value={account.id} />
              <div>
                <label className="label" htmlFor="name">Name</label>
                <input id="name" name="name" defaultValue={account.name} required className="input" />
              </div>
              <div>
                <label className="label" htmlFor="notes">Notes</label>
                <textarea id="notes" name="notes" rows={3} defaultValue={account.notes ?? ""} className="input" />
              </div>
            </ActionForm>
          </Card>

          {isAdmin(user) ? (
            <Card title="Who can use this account">
              <ActionForm action={setAccountAccessAction} submit="Save access">
                <input type="hidden" name="id" value={account.id} />
                <div>
                  <label className="label" htmlFor="ownerId">Owner</label>
                  <select id="ownerId" name="ownerId" defaultValue={account.ownerId} className="input">
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <fieldset className="space-y-2">
                  <legend className="label">Users with access</legend>
                  {users.filter((u) => u.role !== "SUPER_ADMIN").map((u) => (
                    <label key={u.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" name="userIds" value={u.id} defaultChecked={accessIds.has(u.id)} className="h-4 w-4 accent-brand-600" />
                      <span className="min-w-0 truncate">
                        {u.name} <span className="text-gray-500">{u.email}</span>
                      </span>
                      {!u.active ? <Badge value="DISABLED" /> : null}
                    </label>
                  ))}
                  <p className="hint">Super admins always see every account.</p>
                </fieldset>
              </ActionForm>
            </Card>
          ) : null}

          {canDelete ? (
            <Card title="Danger zone">
              <p className="mb-3 text-sm text-gray-600">Deleting removes all apps, templates, campaigns and message history of this account.</p>
              <ConfirmButton action={deleteAccountAction} fields={{ id: account.id }} label="Delete account" confirm="Delete everything?" />
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
