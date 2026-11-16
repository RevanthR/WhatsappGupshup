import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { Badge, Card, fmtDate, PageHeader } from "@/components/ui";
import { CreateUserForm, EditUser } from "./forms";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const [users, accounts] = await Promise.all([
    prisma.user.findMany({
      include: { accounts: { select: { accountId: true } }, _count: { select: { messages: true } } },
      orderBy: [{ active: "desc" }, { name: "asc" }],
    }),
    prisma.gupshupAccount.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <>
      <PageHeader title="Users" description="People who can sign in. Users only see the accounts you give them." />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          {users.map((u) => (
            <details key={u.id} className="card group">
              <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-5">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-gray-900">{u.name}{u.id === me.id ? " (you)" : ""}</span>
                  <span className="block truncate text-xs text-gray-500">
                    {u.email} · {u.role === "SUPER_ADMIN" ? "all accounts" : `${u.accounts.length} account${u.accounts.length === 1 ? "" : "s"}`} · added {fmtDate(u.createdAt)}
                  </span>
                </span>
                <span className="flex items-center gap-2">
                  <Badge value={u.role} label={u.role === "SUPER_ADMIN" ? "Super admin" : "User"} />
                  {!u.active ? <Badge value="DISABLED" /> : u.mustChangePassword ? <Badge value="PENDING" label="Invited" /> : null}
                  <span className="text-gray-400 transition group-open:rotate-180">▾</span>
                </span>
              </summary>
              <div className="border-t border-gray-100 p-4 sm:p-5">
                <EditUser
                  user={{ id: u.id, name: u.name, role: u.role, active: u.active, accountIds: u.accounts.map((a) => a.accountId) }}
                  accounts={accounts}
                  isSelf={u.id === me.id}
                />
              </div>
            </details>
          ))}
        </div>
        <div>
          <Card title="Add user">
            <CreateUserForm accounts={accounts} />
          </Card>
        </div>
      </div>
    </>
  );
}
