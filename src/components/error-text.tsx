import { friendlyError } from "@/lib/errors";

// Shows a plain-English explanation with the raw provider error underneath.
export function ErrorText({ error, className = "" }: { error: string | null | undefined; className?: string }) {
  if (!error) return null;
  const friendly = friendlyError(error);
  return (
    <span className={`block ${className}`}>
      <span className="block text-red-700">{friendly ?? error}</span>
      {friendly ? <span className="block text-[11px] text-gray-400">{error}</span> : null}
    </span>
  );
}
