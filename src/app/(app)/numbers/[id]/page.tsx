import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleApp, requireUser } from "@/lib/access";
import { getOrigin } from "@/lib/origin";
import { formatPhone } from "@/lib/phone";
import { friendlyError } from "@/lib/errors";
import { deleteAppAction, rotateWebhookAction, syncTemplatesAction, updateAppAction } from "@/app/actions/accounts";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { WebhookSetup } from "@/components/webhook-setup";
import { AppFields } from "@/components/app-fields";
import { ReadinessChips, isReady } from "@/components/readiness";
import { TemplateCard } from "@/components/template-card";
import { Alert, Card, Empty, fmtDate, PageHeader } from "@/components/ui";
import { TestConnection } from "./test-connection";

const TABS = [
  ["templates", "Templates"],
  ["webhook", "Webhook"],
  ["settings", "Settings"],
] as const;

export default async function NumberPage({ params, searchParams }: PageProps<"/numbers/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const app = await getAccessibleApp(user, id);
  const templates = await prisma.template.findMany({
    where: { appId: id, status: { not: "DELETED" } },
    orderBy: [{ elementName: "asc" }],
  });
  const approved = templates.filter((t) => t.status === "APPROVED");
  const others = templates.filter((t) => t.status !== "APPROVED");
  const tab = TABS.some(([k]) => k === sp.tab) ? (sp.tab as string) : "templates";
  const health = { ...app, approvedCount: approved.length };
  const webhookUrl = `${await getOrigin()}/api/webhooks/gupshup/${app.webhookToken}`;

  return (
    <>
      <PageHeader
        title={app.name}
        description={
          <>
            {formatPhone(app.sourceNumber)} · <Link href={`/accounts/${app.accountId}`} className="text-brand-700 hover:underline">{app.account.name}</Link>
          </>
        }
        actions={
          approved.length ? (
            <>
              <Link href={`/send?app=${app.id}`} className="btn-secondary">Send one</Link>
              <Link href={`/bulk?app=${app.id}`} className="btn-primary">Bulk send</Link>
            </>
          ) : null
        }
      />

      <div className="mb-4">
        <ReadinessChips app={health} />
      </div>

      {sp.new ? (
        <div className="mb-4">
          <Alert tone="success">
            <b>Number connected</b> and {approved.length} approved template{approved.length === 1 ? "" : "s"} imported. Last step: set up the webhook below.
          </Alert>
        </div>
      ) : isReady(health) ? null : app.lastSyncError ? (
        <div className="mb-4">
          <Alert tone="error">
            <p className="font-medium">{friendlyError(app.lastSyncError) ?? "Gupshup rejected the last sync."}</p>
            <p className="mt-1 break-words text-xs opacity-80">{app.lastSyncError}</p>
            <Link href="?tab=settings" className="mt-2 inline-block text-sm font-medium underline">Fix in Settings</Link>
          </Alert>
        </div>
      ) : null}

      <nav className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map(([k, label]) => (
          <Link
            key={k}
            href={`?tab=${k}`}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              tab === k ? "border-brand-600 text-brand-700" : "border-transparent text-gray-500 hover:text-gray-800"
            }`}
          >
            {label}
            {k === "templates" ? <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 text-xs text-gray-600">{approved.length}</span> : null}
            {k === "webhook" && !app.lastWebhookAt ? <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-500" /> : null}
          </Link>
        ))}
      </nav>

      {tab === "templates" ? (
        <>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Create and edit templates in Gupshup. They appear here after WhatsApp approves them.
              {app.templatesSyncedAt ? ` Last synced ${fmtDate(app.templatesSyncedAt)}.` : ""}
            </p>
            <ActionForm action={syncTemplatesAction} submit="Sync from Gupshup" pendingLabel="Syncing..." submitClass="btn-secondary" className="" inlineAlerts={false}>
              <input type="hidden" name="id" value={app.id} />
            </ActionForm>
          </div>
          {templates.length === 0 ? (
            <Empty title="No templates yet">Create a template in Gupshup, wait for approval, then click Sync.</Empty>
          ) : (
            <>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {approved.map((t) => <TemplateCard key={t.id} t={t} />)}
              </div>
              {others.length ? (
                <>
                  <h3 className="mb-3 mt-8 text-sm font-semibold text-gray-500">Not sendable ({others.length})</h3>
                  <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    {others.map((t) => <TemplateCard key={t.id} t={t} />)}
                  </div>
                </>
              ) : null}
            </>
          )}
        </>
      ) : null}

      {tab === "webhook" ? (
        <div className="max-w-2xl">
          <Card title="Webhook setup">
            <WebhookSetup url={webhookUrl} lastEventAt={app.lastWebhookAt?.toISOString() ?? null} lastEventLabel={fmtDate(app.lastWebhookAt)} />
            <div className="mt-6 border-t border-gray-100 pt-4">
              <p className="mb-2 text-xs text-gray-500">
                URL shared by mistake? Generate a new secret URL. The old one stops working at once, so paste the new one in Gupshup right after.
              </p>
              <ConfirmButton
                action={rotateWebhookAction}
                fields={{ id: app.id }}
                label="Generate new secret URL"
                className="btn-secondary text-xs"
                confirm="Old URL stops working. Continue?"
                toastText="New webhook URL generated. Paste it in Gupshup now."
              />
            </div>
          </Card>
        </div>
      ) : null}

      {tab === "settings" ? (
        <div className="grid max-w-5xl gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <Card title="Gupshup details">
              <ActionForm action={updateAppAction} pendingLabel="Checking with Gupshup...">
                <input type="hidden" name="id" value={app.id} />
                <AppFields values={app} />
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="active" defaultChecked={app.active} className="h-4 w-4 accent-brand-600" />
                  Active. Turn off to hide this number from sending without deleting it.
                </label>
                <p className="hint">If you change the app name, app ID or API key, they are checked with Gupshup before saving.</p>
              </ActionForm>
            </Card>
          </div>
          <div className="space-y-6">
            <Card title="Connection">
              <p className="mb-3 text-sm text-gray-600">
                {app.keyVerifiedAt ? `Last verified ${fmtDate(app.keyVerifiedAt)}.` : "Not verified yet."} Saved key ends in <span className="font-mono">{app.apiKeyLast4}</span>.
              </p>
              <TestConnection appId={app.id} gupshupAppName={app.gupshupAppName} gupshupAppId={app.gupshupAppId ?? ""} />
            </Card>
            <Card title="Delete number">
              <p className="mb-3 text-sm text-gray-600">Removes this number with its templates, campaigns, inbox and history from WA Sender. Nothing changes in Gupshup.</p>
              <ConfirmButton action={deleteAppAction} fields={{ id: app.id }} label="Delete number" confirm="Delete permanently?" />
            </Card>
          </div>
        </div>
      ) : null}
    </>
  );
}
