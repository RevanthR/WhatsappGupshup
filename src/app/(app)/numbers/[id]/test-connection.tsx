"use client";

import { useState, useTransition } from "react";
import { verifyConnectionAction, type VerifyResult } from "@/app/actions/accounts";
import { Alert } from "@/components/ui";
import { Spinner, toast } from "@/components/toast";

// Tests the saved key and details against Gupshup without changing anything.
export function TestConnection({ appId, gupshupAppName, gupshupAppId }: { appId: string; gupshupAppName: string; gupshupAppId: string }) {
  const [r, setR] = useState<VerifyResult | null>(null);
  const [pending, start] = useTransition();
  return (
    <div className="space-y-3">
      <button
        type="button"
        className="btn-secondary w-full"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await verifyConnectionAction({ appId, gupshupAppName, gupshupAppId, apiKey: "" });
            setR(res);
            toast(res.ok ? "Gupshup accepted the saved details." : res.error, res.ok ? "success" : "error");
          })
        }
      >
        {pending ? <><Spinner /> Testing...</> : "Test connection"}
      </button>
      {r && !r.ok ? (
        <Alert tone="error">
          <p className="font-medium">{r.error}</p>
          {r.detail ? <p className="mt-1 break-words text-xs opacity-80">{r.detail}</p> : null}
        </Alert>
      ) : null}
      {r?.ok ? <Alert tone="success">Working. {r.approved} approved template{r.approved === 1 ? "" : "s"} visible.</Alert> : null}
    </div>
  );
}
