import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getAccessibleApp, requireUser } from "@/lib/access";
import { getOrigin } from "@/lib/origin";
import { deleteAppAction, rotateWebhookAction, syncTemplatesAction, updateAppAction } from "@/app/actions/accounts";
import { ActionForm, ConfirmButton } from "@/components/action-form";
import { WebhookSetup } from "@/components/webhook-setup";
import { AppFields } from "@/components/app-fields";
import { Alert, Badge, Card, Empty, fmtDate, PageHeader } from "@/components/ui";

export default async function AppPage({ params, searchParams }: PageProps<"/apps/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const user = await requireUser();
  const app = await getAccessibleApp(user, id);
  const templates = await prisma.template.findMany({
    where: { appId: id },
    orderBy: [{ status: "asc" }, { elementName: "asc" }],
  });
  const webhookUrl = `${await getOrigin()}/api/webhooks/gupshup/${app.webhookToken}`;
  const approved = templates.filter((t) => t.status === "APPROVED");
  const others = templates.filter((t) => t.status !== "APPROVED");

  return (
    <>
      <PageHeader
        title={app.name}
        description={
          <>
            <Link href={`/accounts/${app.accountId}`} className="text-brand-700 hover:underline">{app.account.name}</Link>
            {" · "}+{app.sourceNumber}
          </>
        }
        actions={
          <>
            <Link href={`/send?app=${app.id}`} className="btn-secondary">Send one</Link>
            <Link href={`/bulk?app=${app.id}`} className="btn-primary">Bulk send</Link>
          </>
        }
      />
      {sp.created ? (
        <div className="mb-6">
          <Alert tone="success">App added. Next, copy the webhook URL below into Gupshup so delivery reports and replies come in.</Alert>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card
            title={`Templates (${approved.length} approved)`}
            actions={
              <ActionForm action={syncTemplatesAction} submit="Sync from Gupshup" pendingLabel="Syncing..." submitClass="btn-secondary" className="flex flex-col items-end gap-2">
                <input type="hidden" name="id" value={app.id} />
              </ActionForm>
            }
          >
            <p className="mb-4 text-xs text-gray-500">
              {app.templatesSyncedAt ? `Last synced ${fmtDate(app.templatesSyncedAt)}.` : "Not synced yet."} Create and edit templates in Gupshup, then sync here.
            </p>
            {templates.length === 0 ? (
              <Empty title="No templates">Sync to pull templates from Gupshup.</Empty>
            ) : (
              <ul className="space-y-3">
                {[...approved, ...others].map((t) => (
                  <li key={t.id} className="rounded-lg border border-gray-200 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-sm font-medium text-gray-900">{t.elementName}</span>
                      <Badge value={t.status} />
                      <span className="text-xs text-gray-500">
                        {t.templateType.toLowerCase()} · {t.languageCode} {t.category ? `· ${t.category.toLowerCase()}` : ""} · {t.paramCount} variable{t.paramCount === 1 ? "" : "s"}
                      </span>
                    </div>
                    {t.header ? <p className="mt-2 text-sm font-semibold text-gray-800">{t.header}</p> : null}
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">{t.body}</p>
                    {t.footer ? <p className="mt-1 text-xs text-gray-500">{t.footer}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card title="Webhook setup">
            <WebhookSetup url={webhookUrl} lastEventAt={app.lastWebhookAt?.toISOString() ?? null} lastEventLabel={fmtDate(app.lastWebhookAt)} />
            <div className="mt-4 border-t border-gray-100 pt-3">
              <p className="mb-2 text-xs text-gray-500">URL leaked or shared by mistake? Generate a new secret. The old URL stops working at once, so update Gupshup right after.</p>
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

          <Card title="Settings">
            <ActionForm action={updateAppAction}>
              <input type="hidden" name="id" value={app.id} />
              <AppFields values={app} narrow />
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="active" defaultChecked={app.active} className="h-4 w-4 accent-brand-600" />
                Active (disabled apps are hidden from sending)
              </label>
            </ActionForm>
          </Card>

          <Card title="Danger zone">
            <p className="mb-3 text-sm text-gray-600">Deleting removes templates, campaigns, inbox and history for this app.</p>
            <ConfirmButton action={deleteAppAction} fields={{ id: app.id }} label="Delete app" confirm="Delete this app?" />
          </Card>
        </div>
      </div>
    </>
  );
}
