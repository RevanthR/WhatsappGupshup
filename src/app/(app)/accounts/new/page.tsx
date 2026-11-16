import { prisma } from "@/lib/prisma";
import { isAdmin, requireUser } from "@/lib/access";
import { createAccountAction } from "@/app/actions/accounts";
import { ActionForm } from "@/components/action-form";
import { Card, PageHeader } from "@/components/ui";

export const metadata = { title: "Add account" };

export default async function NewAccountPage() {
  const user = await requireUser();
  const users = isAdmin(user)
    ? await prisma.user.findMany({ where: { active: true }, select: { id: true, name: true, email: true }, orderBy: { name: "asc" } })
    : [];
  return (
    <div className="max-w-2xl">
      <PageHeader title="Add Gupshup account" description="Group the WhatsApp apps that belong to one Gupshup login or business." />
      <Card>
        <ActionForm action={createAccountAction} submit="Create account" pendingLabel="Creating...">
          <div>
            <label className="label" htmlFor="name">Account name</label>
            <input id="name" name="name" required className="input" placeholder="e.g. Acme Retail" />
          </div>
          <div>
            <label className="label" htmlFor="notes">Notes (optional)</label>
            <textarea id="notes" name="notes" rows={2} className="input" placeholder="Gupshup login email, billing contact..." />
          </div>
          {users.length ? (
            <div>
              <label className="label" htmlFor="ownerId">Owner</label>
              <select id="ownerId" name="ownerId" className="input" defaultValue={user.id}>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.name} ({u.email})</option>
                ))}
              </select>
              <p className="hint">The owner gets access automatically. You can add more users afterwards.</p>
            </div>
          ) : null}
        </ActionForm>
      </Card>
    </div>
  );
}
