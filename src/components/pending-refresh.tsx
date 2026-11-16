"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { refreshPendingAction } from "@/app/actions/templates";
import { toast } from "@/components/toast";

// While templates await WhatsApp review, re-sync from Gupshup every minute.
export function PendingRefresh({ appIds }: { appIds: string[] }) {
  const router = useRouter();
  const key = appIds.join(",");
  useEffect(() => {
    if (!key) return;
    const ids = key.split(",");
    const t = setInterval(async () => {
      if (document.hidden) return;
      const r = await refreshPendingAction(ids).catch(() => null);
      if (r?.changed) {
        toast("A template's review status changed.", "info");
        router.refresh();
      }
    }, 60_000);
    return () => clearInterval(t);
  }, [key, router]);
  return null;
}
