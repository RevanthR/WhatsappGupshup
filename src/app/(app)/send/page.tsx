import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { appWhere, requireUser } from "@/lib/access";
import { Empty, PageHeader } from "@/components/ui";
import { SendForm } from "./form";

export const metadata = { title: "Send message" };

export default async function SendPage({ searchParams }: PageProps<"/send">) {
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
      <PageHeader title="Send message" description="Send one approved template message to one number." />
      {apps.length === 0 ? (
        <Empty title="No WhatsApp numbers available">
          <Link href="/numbers/new" className="text-brand-700 hover:underline">Connect a WhatsApp number</Link> first, or ask your admin for access.
        </Empty>
      ) : (
        <SendForm
          apps={apps}
          initialAppId={typeof sp.app === "string" ? sp.app : undefined}
          initialTemplateId={typeof sp.template === "string" ? sp.template : undefined}
          initialPhone={typeof sp.phone === "string" ? sp.phone : undefined}
        />
      )}
    </>
  );
}
