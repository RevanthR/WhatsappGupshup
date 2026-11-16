import Link from "next/link";
import { requireAdmin } from "@/lib/access";
import { listBusinesses } from "@/lib/businesses";
import { Card, PageHeader } from "@/components/ui";
import { CreateUserForm } from "../forms";

export const metadata = { title: "Add user" };

export default async function NewUserPage() {
  await requireAdmin();
  const businesses = await listBusinesses();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add user" description={<Link href="/users" className="text-brand-700 hover:underline">All users</Link>} />
      <Card>
        <CreateUserForm businesses={businesses} />
      </Card>
    </div>
  );
}
