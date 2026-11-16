import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { Badge, Card, fmtDate, PageHeader } from "@/components/ui";

export const metadata = { title: "Users" };

export default async function UsersPage() {
  const me = await requireAdmin();
  const users = await prisma.user.findMany({
    include: {
      accounts: { include: { account: { select: { name: true } } } },
      _count: { select: { messages: true } },
    },
    orderBy: [{ active: "desc" }, { role: "asc" }, { name: "asc" }],
  });
  const status = (u: (typeof users)[number]) =>
    !u.active ? <Badge value="DISABLED" /> : u.mustChangePassword ? <Badge value="PENDING" label="Invited" /> : <Badge value="ACTIVE" label="Active" />;
  const access = (u: (typeof users)[number]) =>
    u.role === "SUPER_ADMIN" ? (
      <span className="text-gray-500">Everything</span>
    ) : u.accounts.length ? (
      u.accounts.map((a) => a.account.name).join(", ")
    ) : (
      <span className="text-amber-700">No access yet</span>
    );

  return (
    <>
      <PageHeader
        title="Users"
        description="People who can sign in. Users only see the businesses you give them."
        actions={<Link href="/users/new" className="btn-primary">+ Add user</Link>}
      />

      <ul className="space-y-3 md:hidden">
        {users.map((u) => (
          <li key={u.id}>
            <Link href={`/users/${u.id}`} className="card block p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{u.name}{u.id === me.id ? " (you)" : ""}</p>
                  <p className="truncate text-xs text-gray-500">{u.email}</p>
                </div>
                {status(u)}
              </div>
              <p className="mt-2 text-xs text-gray-600">
                <Badge value={u.role} label={u.role === "SUPER_ADMIN" ? "Super admin" : "User"} /> <span className="ml-1">{access(u)}</span>
              </p>
            </Link>
          </li>
        ))}
      </ul>

      <Card className="hidden md:block">
        <div className="-mx-5 -my-5 overflow-x-auto">
          <table className="table">
            <thead>
              <tr><th>Name</th><th>Role</th><th>Access</th><th>Status</th><th>Messages sent</th><th>Last sign-in</th><th /></tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td>
                    <Link href={`/users/${u.id}`} className="font-medium text-gray-900 hover:text-brand-700">{u.name}{u.id === me.id ? " (you)" : ""}</Link>
                    <p className="text-xs text-gray-500">{u.email}</p>
                  </td>
                  <td><Badge value={u.role} label={u.role === "SUPER_ADMIN" ? "Super admin" : "User"} /></td>
                  <td className="max-w-xs text-gray-700">{access(u)}</td>
                  <td>{status(u)}</td>
                  <td className="tabular-nums">{u._count.messages.toLocaleString("en-IN")}</td>
                  <td className="whitespace-nowrap text-gray-500">{u.lastLoginAt ? fmtDate(u.lastLoginAt) : "Never"}</td>
                  <td><Link href={`/users/${u.id}`} className="text-sm text-brand-700 hover:underline">Manage</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
