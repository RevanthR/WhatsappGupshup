@AGENTS.md

# WhatsappGupshup

WhatsApp bulk and single sender on Gupshup, with a multi-user admin. See README.md for features and architecture.

- Stack: Next.js 16 App Router, Prisma 7 + `@prisma/adapter-pg` (Neon in prod, local Postgres `wa_sender` in dev), NextAuth v5 credentials (JWT), Tailwind v4, exceljs, libphonenumber-js.
- GitHub: `RevanthR/WhatsappGupshup` over `github-revanthr`. Vercel: team `team_JTTwWpOjdIAl5GyLgm3LDioG` (revanth-rallabandis-projects), project `whatsapp-gupshup` (`prj_fvxg9wU1JlCpa5Trl82BtCXx8Hpg`), live at https://whatsapp-gupshup-three.vercel.app. Functions and Neon DB in Singapore (sin1). Deploy by pushing to `main`. `VERCEL_TOKEN` is in local `.env`.
- Access rules live in `src/lib/access.ts` (`appWhere` / `accountWhere`). Every query on apps, campaigns, messages or contacts must go through them.
- Gupshup client: `src/lib/gupshup.ts`. Bulk worker: `src/lib/worker.ts` plus `src/app/api/worker/campaigns/[id]`. Webhook: `src/app/api/webhooks/gupshup/[token]`.
- Template variables: text header vars come first, then body vars, in one params array (`src/lib/template-vars.ts`).
- Never change `ENCRYPTION_KEY` once API keys are stored.
- Custom CSS classes (`btn-primary`, `card`, `input`...) are Tailwind v4 `@utility` blocks in `globals.css`.
- No em dashes anywhere.
- UI wording: a Gupshup account is a "business", a Gupshup app is a "WhatsApp number" (`/numbers`). Model names stay `GupshupAccount` / `App`.
- Gupshup keys are always tested before saving (`verifyConnectionAction`, `createNumberAction`, `updateAppAction`). Friendly error text lives in `src/lib/errors.ts`.
