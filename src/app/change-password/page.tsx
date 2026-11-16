import Link from "next/link";
import { requireUser } from "@/lib/access";
import { ChangePasswordForm } from "./form";

export const metadata = { title: "Change password" };

export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <h1 className="text-xl font-semibold text-gray-900">Change password</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">
          {user.mustChangePassword ? "Set your own password before you continue." : "Choose a new password for your account."}
        </p>
        <div className="card p-6">
          <ChangePasswordForm />
        </div>
        {!user.mustChangePassword ? (
          <p className="mt-4 text-center text-sm">
            <Link href="/" className="text-brand-700 hover:underline">Back to dashboard</Link>
          </p>
        ) : null}
      </div>
    </div>
  );
}
