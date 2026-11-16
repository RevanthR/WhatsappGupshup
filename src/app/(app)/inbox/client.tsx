"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { replyAction } from "@/app/actions/send";
import { Spinner, toast } from "@/components/toast";

export function InboxPoller({ every = 5000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => {
      if (!document.hidden) router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every]);
  return null;
}

export function ReplyBox({ contactId }: { contactId: string }) {
  const [state, action, pending] = useActionState(replyAction, undefined);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state?.ok) ref.current?.reset();
    if (state?.error) toast(state.error, "error");
  }, [state]);
  return (
    <form ref={ref} action={action} className="flex items-end gap-2">
      <input type="hidden" name="contactId" value={contactId} />
      <textarea
        name="text"
        rows={1}
        required
        placeholder="Type a reply"
        className="input max-h-40 min-h-[40px] flex-1 resize-y"
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            e.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <button className="btn-primary h-10" disabled={pending}>{pending ? <Spinner /> : "Send"}</button>
    </form>
  );
}
