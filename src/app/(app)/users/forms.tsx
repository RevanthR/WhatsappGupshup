"use client";

import { useActionState } from "react";
import { createUserAction, resetPasswordAction, updateUserAction, type UserState } from "@/app/actions/users";
import { useResultToast, CopyField } from "@/components/action-form";
import { Alert } from "@/components/ui";
import { Spinner } from "@/components/toast";

type Acct = { id: string; name: string };

function AccountChecks({ accounts, selected = [] }: { accounts: Acct[]; selected?: string[] }) {
  if (accounts.length === 0) return <p className="hint">No accounts yet.</p>;
  return (
    <div className="max-h-48 space-y-1.5 overflow-y-auto rounded-lg border border-gray-200 p-2">
      {accounts.map((a) => (
        <label key={a.id} className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="accountIds" value={a.id} defaultChecked={selected.includes(a.id)} className="h-4 w-4 accent-brand-600" />
          {a.name}
        </label>
      ))}
    </div>
  );
}

function Credentials({ state }: { state: UserState }) {
  if (!state?.tempPassword) return null;
  const text = `Sign in at ${typeof window !== "undefined" ? window.location.origin : ""}/login\nEmail: ${state.email}\nTemporary password: ${state.tempPassword}`;
  return (
    <Alert tone="success">
      <p className="mb-2 font-medium">Share these sign-in details. The password is shown only once.</p>
      <pre className="mb-2 whitespace-pre-wrap rounded bg-white/70 p-2 font-mono text-xs text-gray-800">{text}</pre>
      <CopyField value={text.replace(/\n/g, " | ")} />
    </Alert>
  );
}

export function CreateUserForm({ accounts }: { accounts: Acct[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  useResultToast(state);
  return (
    <form action={action} className="space-y-4" key={state?.tempPassword ?? "new"}>
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <Credentials state={state} />
      <div>
        <label className="label" htmlFor="new-name">Name</label>
        <input id="new-name" name="name" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="new-email">Email</label>
        <input id="new-email" name="email" type="email" required className="input" />
      </div>
      <div>
        <label className="label" htmlFor="new-role">Role</label>
        <select id="new-role" name="role" className="input" defaultValue="USER">
          <option value="USER">User</option>
          <option value="SUPER_ADMIN">Super admin</option>
        </select>
      </div>
      <div>
        <p className="label">Accounts they can use</p>
        <AccountChecks accounts={accounts} />
      </div>
      <button className="btn-primary w-full" disabled={pending}>{pending ? <><Spinner /> Adding...</> : "Add user"}</button>
      <p className="hint">A temporary password is generated. They must change it on first sign-in.</p>
    </form>
  );
}

export function EditUser({
  user,
  accounts,
  isSelf,
}: {
  user: { id: string; name: string; role: string; active: boolean; accountIds: string[] };
  accounts: Acct[];
  isSelf: boolean;
}) {
  const [state, action, pending] = useActionState(updateUserAction, undefined);
  const [resetState, resetAction, resetting] = useActionState(resetPasswordAction, undefined);
  useResultToast(state);
  useResultToast(resetState);
  return (
    <div className="space-y-4">
      <form action={action} className="grid gap-4 sm:grid-cols-2">
        <input type="hidden" name="id" value={user.id} />
        {state?.error ? <div className="sm:col-span-2"><Alert tone="error">{state.error}</Alert></div> : null}
        <div>
          <label className="label" htmlFor={`name-${user.id}`}>Name</label>
          <input id={`name-${user.id}`} name="name" defaultValue={user.name} required className="input" />
        </div>
        <div>
          <label className="label" htmlFor={`role-${user.id}`}>Role</label>
          <select id={`role-${user.id}`} name="role" defaultValue={user.role} className="input" disabled={isSelf}>
            <option value="USER">User</option>
            <option value="SUPER_ADMIN">Super admin</option>
          </select>
          {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
        </div>
        <div className="sm:col-span-2">
          <p className="label">Accounts</p>
          <AccountChecks accounts={accounts} selected={user.accountIds} />
          <p className="hint">Ignored for super admins, who see every account.</p>
        </div>
        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} className="h-4 w-4 accent-brand-600" />
          Can sign in
          {isSelf ? <input type="hidden" name="active" value="on" /> : null}
        </label>
        <div className="sm:col-span-2">
          <button className="btn-primary" disabled={pending}>{pending ? <><Spinner /> Saving...</> : "Save"}</button>
        </div>
      </form>
      {!isSelf ? (
        <form action={resetAction} className="space-y-2 border-t border-gray-100 pt-4">
          <input type="hidden" name="id" value={user.id} />
          <Credentials state={resetState} />
          <button className="btn-secondary" disabled={resetting}>{resetting ? <><Spinner /> Resetting...</> : "Reset password"}</button>
        </form>
      ) : null}
    </div>
  );
}
