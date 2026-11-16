# WhatsappGupshup (WA Sender)

Send WhatsApp template messages through Gupshup, one at a time or in bulk from Excel, and reply to customers from a shared inbox.

## Features

- **Users and roles.** Super admin sees and manages everything. Users see only the Gupshup accounts they are given. Login is email and password, with a forced password change on first sign-in.
- **Accounts and apps.** A Gupshup account holds one or more WhatsApp apps. Each app stores its Gupshup app name, sender number, an AES-256-GCM encrypted API key, and its own secret webhook URL.
- **Templates.** Pulled from Gupshup with "Sync from Gupshup". Only approved templates can be sent.
- **Single send.** Pick an app and template, fill in the variables, and see a live preview.
- **Bulk send.** Download an Excel file built for the template, fill it in and upload it. Every row is checked, and you review the result before starting. Sending runs in the background with live progress, pause, resume and cancel. Results can be downloaded as Excel.
- **Inbox.** Customer replies arrive through the webhook. Free-text replies are allowed inside WhatsApp's 24-hour window. After that, the reply box links to a template send.
- **Message log** with filters, and delivery status (sent, delivered, read, failed) taken from webhook events.

## Setup

```bash
cp .env.example .env      # fill in values
npm install
npx prisma migrate dev    # local DB
npm run db:seed           # creates the super admin from SEED_ADMIN_*
npm run dev
```

Production: run `npm run db:deploy` with the production `DATABASE_URL` after any schema change. Vercel does not run migrations.

## Gupshup webhook

Each app gets a URL like `https://<host>/api/webhooks/gupshup/<secret-token>`. The token is 256 random bits, unique to the app, and can be regenerated from the app page. Gupshup does not sign callbacks, so this secret URL is what authenticates them. Paste it in Gupshup under the app's Webhooks or Callback URL, and enable message events and inbound messages. The app page shows "Connected" once the first event arrives.

Both the Gupshup v2 payload and the Meta (v3) payload are accepted.

## How bulk sending works

Vercel functions are short-lived, so a campaign is sent by a chain of short runs:

1. **Start** marks the campaign RUNNING and calls `POST /api/worker/campaigns/:id`. The call is HMAC signed with `WORKER_SECRET`.
2. The worker replies at once. Then, using `after()`, it takes a lease on the campaign and sends for about 40 seconds. It claims rows with `FOR UPDATE SKIP LOCKED`, runs 8 sends at a time, and retries 429 and 5xx errors up to 3 times.
3. If rows are left, it releases the lease and calls itself again.
4. **Safety nets:**
   - The campaign page restarts a stalled chain (no progress for 2 minutes) while it is open, and has a "Resume now" button.
   - A daily Vercel cron (`/api/cron/sweep`, `CRON_SECRET`) restarts anything still stuck.
   - Rows interrupted mid-send are marked failed, not retried, so a number never gets the same message twice.

## Local testing without Gupshup

```bash
node scripts/mock-gupshup.mjs                  # fake Gupshup on :4010
# .env: GUPSHUP_BASE_URL="http://localhost:4010"
npx tsx --conditions=react-server scripts/e2e-local.ts   # E2E_ORIGIN, E2E_N optional
```

The e2e script creates test data in whatever database `DATABASE_URL` points to. Never run it against production.
