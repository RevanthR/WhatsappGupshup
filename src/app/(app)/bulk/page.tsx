import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Empty, PageHeader } from "@/components/ui";
import { BulkForm } from "./form";

export const metadata = { title: "Bulk send" };

export default async function BulkPage({ searchParams }: PageProps<"/bulk">) {
  const sp = await searchParams;
  const user = await requireUser();
  const apps = await prisma.app.findMany({
    where: { ...appWhere(user), active: true },
    select: {
      id: true,
      name: true,
      account: { select: { name: true } },
      templates: {
        where: { status: "APPROVED" },
        select: { id: true, elementName: true, body: true, header: true, footer: true, templateType: true, paramCount: true, languageCode: true, sampleMediaUrl: true },
        orderBy: { elementName: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
  return (
    <>
      <PageHeader title="Bulk send" description="Upload an Excel file to send one template to many numbers." />
      {apps.length === 0 ? (
        <Empty title="No WhatsApp numbers available">
          <Link href="/numbers/new" className="text-brand-700 hover:underline">Connect a WhatsApp number</Link> first, or ask your admin for access.
        </Empty>
      ) : (
        <BulkForm apps={apps} initialAppId={typeof sp.app === "string" ? sp.app : undefined}
          initialTemplateId={typeof sp.template === "string" ? sp.template : undefined} />
      )}
    </>
  );
}
