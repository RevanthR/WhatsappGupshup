"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { campaignProgress } from "@/app/actions/campaigns";

// While a campaign runs, poll its progress (which also restarts a stalled
// chain) and refresh the server-rendered page.
export function LiveRefresh({ active, campaignId }: { active: boolean; campaignId: string }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(async () => {
      if (document.hidden) return;
      await campaignProgress(campaignId).catch(() => null);
      router.refresh();
    }, 4000);
    return () => clearInterval(t);
  }, [active, campaignId, router]);
  return null;
}
