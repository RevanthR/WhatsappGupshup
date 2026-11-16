import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { accountWhere, requireUser } from "@/lib/access";
import { PageHeader } from "@/components/ui";
import { ConnectWizard } from "./wizard";

export const metadata = { title: "Connect a WhatsApp number" };

export default async function NewNumberPage({ searchParams }: PageProps<"/numbers/new">) {
  const sp = await searchParams;
  const user = await requireUser();
  const accounts = await prisma.gupshupAccount.findMany({ where: accountWhere(user), select: { id: true, name: true }, orderBy: { name: "asc" } });
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Connect a WhatsApp number"
        description={<>Takes about 2 minutes. You need access to the Gupshup dashboard. <Link href="/numbers" className="text-brand-700 hover:underline">Cancel</Link></>}
      />
      <ConnectWizard accounts={accounts} initialAccountId={typeof sp.account === "string" ? sp.account : undefined} />
    </div>
  );
}
