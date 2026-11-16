"use client";

import { useEffect, useState } from "react";
import { IndeterminateBar, Spinner } from "@/components/toast";

// Popup shown while a long action runs. Steps advance on a timer so the user
// sees movement; the last step stays until the action finishes.
export function BusyModal({ open, title, steps, stepMs = 1500 }: { open: boolean; title: string; steps: string[]; stepMs?: number }) {
  const [step, setStep] = useState(0);
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (!open) return;
    const started = Date.now();
    const t = setInterval(() => {
      const ms = Date.now() - started;
      setSeconds(Math.floor(ms / 1000));
      setStep(Math.min(steps.length - 1, Math.floor(ms / stepMs)));
    }, 250);
    return () => {
      clearInterval(t);
      setStep(0);
      setSeconds(0);
    };
  }, [open, steps.length, stepMs]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 px-4" role="dialog" aria-modal="true" aria-live="polite">
      <div className="toast-in w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
        <p className="mb-4 font-semibold text-gray-900">{title}</p>
        <ol className="mb-4 space-y-2">
          {steps.map((s, i) => (
            <li key={s} className={`flex items-center gap-2 text-sm ${i < step ? "text-emerald-700" : i === step ? "font-medium text-gray-900" : "text-gray-400"}`}>
              <span className="flex h-5 w-5 items-center justify-center">
                {i < step ? "✓" : i === step ? <Spinner /> : <span className="h-1.5 w-1.5 rounded-full bg-gray-300" />}
              </span>
              {s}
            </li>
          ))}
        </ol>
        <IndeterminateBar />
        <p className="mt-2 text-right text-xs text-gray-500">{seconds}s · please keep this tab open</p>
      </div>
    </div>
  );
}
