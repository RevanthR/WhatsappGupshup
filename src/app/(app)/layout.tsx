import { redirect } from "next/navigation";
import { requireUser, appWhere } from "@/lib/access";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/shell";
import { signOutAction } from "@/app/actions/auth";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  if (user.mustChangePassword) redirect("/change-password");
  const unread = await prisma.contact.aggregate({
    where: { app: appWhere(user), unreadCount: { gt: 0 } },
    _count: true,
  });
  return (
    <Shell user={user} unread={unread._count} signOutAction={signOutAction}>
      {children}
    </Shell>
  );
}
