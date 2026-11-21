"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Refreshes the server-rendered page every few seconds while `active`.
export function AutoRefresh({ active, ms = 4000 }: { active: boolean; ms?: number }) {
  const router = useRouter();
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, ms);
    return () => clearInterval(t);
  }, [active, ms, router]);
  return null;
}
