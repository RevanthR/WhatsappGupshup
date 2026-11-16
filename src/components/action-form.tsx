"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Alert } from "@/components/ui";
import { Spinner, toast } from "@/components/toast";

type State = { error?: string; ok?: string } | undefined;

// Shows toasts whenever an action returns a new result.
export function useResultToast(state: State) {
  useEffect(() => {
    if (state?.ok) toast(state.ok, "success");
    else if (state?.error) toast(state.error, "error");
  }, [state]);
}

export function ActionForm({
  action,
  children,
  submit = "Save",
  pendingLabel = "Saving...",
  className = "space-y-4",
  submitClass = "btn-primary",
  inlineAlerts = true,
}: {
  action: (s: State, f: FormData) => Promise<State>;
  children: ReactNode;
  submit?: string;
  pendingLabel?: string;
  className?: string;
  submitClass?: string;
  inlineAlerts?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  useResultToast(state);
  return (
    <form action={formAction} className={className}>
      {inlineAlerts && state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      {children}
      <div>
        <button className={submitClass} disabled={pending}>
          {pending ? (
            <>
              <Spinner /> {pendingLabel}
            </>
          ) : (
            submit
          )}
        </button>
      </div>
    </form>
  );
}

// Submit button for plain <form action={serverAction}> forms. Shows a spinner
// while the action runs and an optional toast when it is sent.
export function SubmitButton({
  children,
  pendingLabel,
  className = "btn-primary",
  toastText,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  toastText?: string;
}) {
  const { pending } = useFormStatus();
  const [wasPending, setWasPending] = useState(false);
  if (pending !== wasPending) {
    setWasPending(pending);
    if (!pending && toastText) toast(toastText, "success");
  }
  return (
    <button className={className} disabled={pending}>
      {pending ? (
        <>
          <Spinner /> {pendingLabel ?? children}
        </>
      ) : (
        children
      )}
    </button>
  );
}

// Destructive action: asks inline before running.
export function ConfirmButton({
  action,
  fields,
  label,
  confirm,
  className = "btn-danger",
  toastText,
}: {
  action: (f: FormData) => Promise<void>;
  fields: Record<string, string>;
  label: string;
  confirm: string;
  className?: string;
  toastText?: string;
}) {
  const [asking, setAsking] = useState(false);
  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <span className="text-sm text-red-800">{confirm}</span>
      <SubmitButton className="btn-danger" pendingLabel="Working..." toastText={toastText}>Yes</SubmitButton>
      <button type="button" className="btn-secondary" onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  );
}

export function CopyField({ value }: { value: string }) {
  return (
    <div className="flex gap-2">
      <input readOnly value={value} className="input font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
      <button
        type="button"
        className="btn-secondary shrink-0"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            toast("Copied to clipboard", "success");
          } catch {
            toast("Could not copy. Select the text and copy it manually.", "error");
          }
        }}
      >
        Copy
      </button>
    </div>
  );
}
