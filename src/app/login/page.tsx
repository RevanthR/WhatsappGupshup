import { redirect } from "next/navigation";
import { getUser } from "@/lib/access";
import { LoginForm } from "./form";

export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getUser()) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-brand-600 text-white">
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinejoin="round">
              <path d="M3 11.5 21 3l-8.5 18-2.2-7.3z" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">WA Sender</h1>
          <p className="mt-1 text-sm text-gray-500">Sign in to send WhatsApp messages</p>
        </div>
        <div className="card p-6">
          <LoginForm />
        </div>
        <p className="mt-6 text-center text-xs text-gray-500">No account? Ask your administrator to add you.</p>
      </div>
    </div>
  );
}
