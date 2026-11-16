"use client";

import { useEffect, useState } from "react";

type Tone = "success" | "error" | "info";
type Toast = { id: number; tone: Tone; text: string };

// Fire from any client component: toast("Saved", "success").
export function toast(text: string, tone: Tone = "info") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("app:toast", { detail: { text, tone } }));
}

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);
  useEffect(() => {
    let n = 0;
    const onToast = (e: Event) => {
      const { text, tone } = (e as CustomEvent<{ text: string; tone: Tone }>).detail;
      const id = ++n;
      setItems((s) => [...s.slice(-3), { id, text, tone }]);
      setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), tone === "error" ? 8000 : 4000);
    };
    window.addEventListener("app:toast", onToast);
    return () => window.removeEventListener("app:toast", onToast);
  }, []);
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end">
      {items.map((t) => (
        <div
          key={t.id}
          role="status"
          className={`toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2 rounded-lg px-4 py-3 text-sm text-white shadow-lg ${
            t.tone === "success" ? "bg-emerald-600" : t.tone === "error" ? "bg-red-600" : "bg-gray-900"
          }`}
        >
          <span className="mt-0.5 shrink-0">{t.tone === "success" ? "✓" : t.tone === "error" ? "!" : "i"}</span>
          <span className="flex-1">{t.text}</span>
          <button className="shrink-0 opacity-70 hover:opacity-100" aria-label="Dismiss" onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))}>
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

export function Spinner({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// Thin animated bar for work with no measurable progress.
export function IndeterminateBar() {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-100">
      <div className="indeterminate h-full w-1/3 rounded-full bg-brand-600" />
    </div>
  );
}
