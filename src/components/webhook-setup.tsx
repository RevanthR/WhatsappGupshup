"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CopyField } from "@/components/action-form";
import { Spinner } from "@/components/toast";

// Guided Gupshup webhook setup. Polls until the first event arrives.
export function WebhookSetup({ url, lastEventAt, lastEventLabel }: { url: string; lastEventAt: string | null; lastEventLabel: string }) {
  const router = useRouter();
  useEffect(() => {
    if (lastEventAt) return;
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, 5000);
    return () => clearInterval(t);
  }, [lastEventAt, router]);

  return (
    <div className="space-y-4">
      <ol className="space-y-3 text-sm text-gray-700">
        <li>
          <p className="mb-1.5 font-medium text-gray-900">1. Copy your secret webhook URL</p>
          <CopyField value={url} />
          <p className="hint">The last part of the URL is a secret token unique to this app. Anyone with it can post events here, so share it only with Gupshup.</p>
        </li>
        <li>
          <p className="font-medium text-gray-900">2. Paste it in Gupshup</p>
          <p className="text-gray-600">
            Gupshup dashboard, open this app, <b>Webhooks</b> (older dashboards: Settings, Callback URL). Add the URL and turn on <b>Message events</b> (enqueued, sent, delivered, read, failed) and <b>Inbound messages</b>. Save.
          </p>
        </li>
        <li>
          <p className="font-medium text-gray-900">3. Check it works</p>
          <p className="text-gray-600">Send one message from this app, or message the business number from your phone.</p>
        </li>
      </ol>
      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${lastEventAt ? "bg-emerald-50 text-emerald-800" : "bg-amber-50 text-amber-800"}`}>
        {lastEventAt ? (
          <>
            <span>✓</span> Connected. Last event {lastEventLabel}.
          </>
        ) : (
          <>
            <Spinner /> Waiting for the first event from Gupshup...
          </>
        )}
      </div>
    </div>
  );
}
