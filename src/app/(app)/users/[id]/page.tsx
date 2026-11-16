import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/access";
import { listBusinesses } from "@/lib/businesses";
import { Badge, Card, fmtDate, PageHeader, Stat } from "@/components/ui";
import { AccessForm, ProfileForm, ResetPassword } from "../forms";

export default async function UserPage({ params }: PageProps<"/users/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const user = await prisma.user.findUnique({
    where: { id },
    include: { accounts: { select: { accountId: true } }, _count: { select: { messages: true, campaigns: true } } },
  });
  if (!user) notFound();
  const businesses = await listBusinesses();
  const isSelf = user.id === me.id;

  return (
    <>
      <PageHeader
        title={user.name}
        description={<>{user.email} · <Link href="/users" className="text-brand-700 hover:underline">All users</Link></>}
        actions={
          <>
            <Badge value={user.role} label={user.role === "SUPER_ADMIN" ? "Super admin" : "User"} />
            {!user.active ? <Badge value="DISABLED" /> : user.mustChangePassword ? <Badge value="PENDING" label="Invited" /> : <Badge value="ACTIVE" label="Active" />}
          </>
        }
      />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Messages sent" value={user._count.messages.toLocaleString("en-IN")} />
        <Stat label="Campaigns" value={user._count.campaigns} />
        <Stat label="Last sign-in" value={<span className="text-base">{user.lastLoginAt ? fmtDate(user.lastLoginAt) : "Never"}</span>} />
        <Stat label="Added" value={<span className="text-base">{fmtDate(user.createdAt)}</span>} />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card title="Access">
            {user.role === "SUPER_ADMIN" ? (
              <p className="text-sm text-gray-600">Super admins can see and manage every business and number.</p>
            ) : (
              <>
                <p className="mb-4 text-sm text-gray-600">Tick the businesses this person can send from. They see every WhatsApp number in those businesses.</p>
                <AccessForm userId={user.id} businesses={businesses} selected={user.accounts.map((a) => a.accountId)} />
              </>
            )}
          </Card>
        </div>
        <div className="space-y-6">
          <Card title="Profile">
            <ProfileForm user={user} isSelf={isSelf} />
          </Card>
          {!isSelf ? (
            <Card title="Password">
              <ResetPassword userId={user.id} />
            </Card>
          ) : (
            <Card title="Password">
              <Link href="/change-password" className="btn-secondary">Change my password</Link>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
