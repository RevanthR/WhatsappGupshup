import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Empty, PageHeader } from "@/components/ui";
import { TemplateBuilder } from "./builder";

export const metadata = { title: "New template" };

export default async function NewTemplatePage({ searchParams }: PageProps<"/templates/new">) {
  const sp = await searchParams;
  const user = await requireUser();
  const apps = await prisma.app.findMany({
    where: { ...appWhere(user), active: true },
    select: { id: true, name: true, gupshupAppId: true },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader
        title="New template"
        description={<>Create a message template and send it to WhatsApp for approval. <Link href="/templates" className="text-brand-700 hover:underline">Cancel</Link></>}
      />
      {apps.length === 0 ? (
        <Empty title="No WhatsApp numbers yet">
          <Link href="/numbers/new" className="text-brand-700 hover:underline">Connect a number</Link> first.
        </Empty>
      ) : (
        <TemplateBuilder
          apps={apps.map((a) => ({ id: a.id, name: a.name, hasAppId: !!a.gupshupAppId }))}
          initialAppId={typeof sp.app === "string" ? sp.app : undefined}
        />
      )}
    </>
  );
}
