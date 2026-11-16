"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { createUserAction, resetPasswordAction, updateAccessAction, updateProfileAction, type UserState } from "@/app/actions/users";
import { CopyField, useResultToast } from "@/components/action-form";
import { Alert } from "@/components/ui";
import { Spinner } from "@/components/toast";

export type Biz = { id: string; name: string; numbers: string[] };

function RolePicker({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled?: boolean }) {
  const opts = [
    ["USER", "User", "Sends messages from the businesses you pick below. Can add their own numbers."],
    ["SUPER_ADMIN", "Super admin", "Sees and manages everything, including users."],
  ];
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {opts.map(([v, title, desc]) => (
        <label
          key={v}
          className={`flex cursor-pointer gap-3 rounded-lg border p-3 text-sm ${value === v ? "border-brand-500 bg-brand-50" : "border-gray-200 hover:bg-gray-50"} ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
        >
          <input type="radio" name="role" value={v} checked={value === v} disabled={disabled} onChange={() => onChange(v)} className="mt-0.5 accent-brand-600" />
          <span>
            <span className="block font-medium text-gray-900">{title}</span>
            <span className="block text-xs text-gray-500">{desc}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

function BusinessPicker({ businesses, selected = [] }: { businesses: Biz[]; selected?: string[] }) {
  if (businesses.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 p-3 text-sm text-gray-500">
        No businesses yet. <Link href="/numbers/new" className="text-brand-700 hover:underline">Connect a number</Link> first, then give access.
      </p>
    );
  }
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {businesses.map((b) => (
        <label key={b.id} className="flex cursor-pointer gap-3 rounded-lg border border-gray-200 p-3 text-sm hover:bg-gray-50 has-[:checked]:border-brand-500 has-[:checked]:bg-brand-50">
          <input type="checkbox" name="accountIds" value={b.id} defaultChecked={selected.includes(b.id)} className="mt-0.5 h-4 w-4 accent-brand-600" />
          <span className="min-w-0">
            <span className="block font-medium text-gray-900">{b.name}</span>
            <span className="block truncate text-xs text-gray-500">{b.numbers.length ? b.numbers.join(", ") : "No numbers yet"}</span>
          </span>
        </label>
      ))}
    </div>
  );
}

export function Credentials({ state }: { state: UserState }) {
  if (!state?.tempPassword) return null;
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const text = `Sign in at ${origin}/login with ${state.email} and temporary password ${state.tempPassword}. You will be asked to set your own password.`;
  return (
    <Alert tone="success">
      <p className="mb-1 font-medium">Send these sign-in details to them. The password is shown only once.</p>
      <dl className="mb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-sm">
        <dt className="text-emerald-900/70">Link</dt><dd className="break-all">{origin}/login</dd>
        <dt className="text-emerald-900/70">Email</dt><dd className="break-all">{state.email}</dd>
        <dt className="text-emerald-900/70">Password</dt><dd className="font-mono">{state.tempPassword}</dd>
      </dl>
      <CopyField value={text} />
    </Alert>
  );
}

export function CreateUserForm({ businesses }: { businesses: Biz[] }) {
  const [state, action, pending] = useActionState(createUserAction, undefined);
  const [role, setRole] = useState("USER");
  useResultToast(state);
  if (state?.tempPassword) {
    return (
      <div className="space-y-4">
        <Credentials state={state} />
        <div className="flex flex-wrap gap-2">
          <Link href={`/users/${state.userId}`} className="btn-secondary">Open their profile</Link>
          <Link href="/users" className="btn-primary">Done</Link>
        </div>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-5">
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor="name">Name</label>
          <input id="name" name="name" required className="input" autoFocus />
        </div>
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" name="email" type="email" required className="input" />
        </div>
      </div>
      <div>
        <p className="label">Role</p>
        <RolePicker value={role} onChange={setRole} />
      </div>
      {role === "USER" ? (
        <div>
          <p className="label">Businesses they can use</p>
          <BusinessPicker businesses={businesses} />
          <p className="hint">They can send from every WhatsApp number in the businesses you tick. Change this any time.</p>
        </div>
      ) : null}
      <button className="btn-primary" disabled={pending}>{pending ? <><Spinner /> Adding...</> : "Add user"}</button>
      <p className="hint">A temporary password is created. They set their own on first sign-in.</p>
    </form>
  );
}

export function ProfileForm({ user, isSelf }: { user: { id: string; name: string; role: string; active: boolean }; isSelf: boolean }) {
  const [state, action, pending] = useActionState(updateProfileAction, undefined);
  const [role, setRole] = useState(user.role);
  useResultToast(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={user.id} />
      {state?.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div>
        <label className="label" htmlFor="name">Name</label>
        <input id="name" name="name" defaultValue={user.name} required className="input" />
      </div>
      <div>
        <p className="label">Role</p>
        <RolePicker value={role} onChange={setRole} disabled={isSelf} />
        {isSelf ? <input type="hidden" name="role" value={user.role} /> : null}
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="active" defaultChecked={user.active} disabled={isSelf} className="h-4 w-4 accent-brand-600" />
        Can sign in
        {isSelf ? <input type="hidden" name="active" value="on" /> : null}
      </label>
      <button className="btn-primary" disabled={pending}>{pending ? <><Spinner /> Saving...</> : "Save"}</button>
    </form>
  );
}

export function AccessForm({ userId, businesses, selected }: { userId: string; businesses: Biz[]; selected: string[] }) {
  const [state, action, pending] = useActionState(updateAccessAction, undefined);
  useResultToast(state);
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="id" value={userId} />
      <BusinessPicker businesses={businesses} selected={selected} />
      <button className="btn-primary" disabled={pending || businesses.length === 0}>{pending ? <><Spinner /> Saving...</> : "Save access"}</button>
    </form>
  );
}

export function ResetPassword({ userId }: { userId: string }) {
  const [state, action, pending] = useActionState(resetPasswordAction, undefined);
  useResultToast(state);
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="id" value={userId} />
      <Credentials state={state} />
      <p className="text-sm text-gray-600">Creates a new temporary password. Their current password stops working.</p>
      <button className="btn-secondary" disabled={pending}>{pending ? <><Spinner /> Resetting...</> : "Reset password"}</button>
    </form>
  );
}
