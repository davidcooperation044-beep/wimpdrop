# Supplier Edge Functions

Set these encrypted Supabase secrets before deploying:

- `CJ_EMAIL`
- `CJ_OPEN_ID`
- `CJ_THIRD_ACCOUNT_ID`
- `CJ_REDIRECT_URI`
- `CJ_API_BASE_URL` (optional; defaults to CJ's official API base)
- `SUPABASE_SERVICE_ROLE_KEY`
- `FLW_SECRET_KEY`
- `FLW_WEBHOOK_SECRET_HASH`
- `CRON_SECRET`
- `APP_ORIGIN`

The browser must never receive CJ credentials or call CJ directly.

Supplier orchestration uses `SupplierAdapter` in `_shared/supplier.ts`; CJ is
implemented by `_shared/cj-adapter.ts`. No Zendrop or Spocket adapter is added
yet: current public materials emphasize managed platform integrations rather
than a clearly documented free custom-site API, and CJ has not been tested in
this environment enough to establish a reliability failure. A second adapter
should be added only after a provider account/API contract is verified.

Functions:

- `cj-auth`: admin-only OAuth start/complete and token cache refresh.
- `products-sync-status`: admin-only sync status endpoint.
- `admin-products-import`: admin-only CJ product import into unpublished drafts.
- `create-payment-intent`: authenticated checkout intent creation.
- `flutterwave-webhook`: signature and server-side transaction verification, order creation, and forwarding trigger.
- `stock-sync`: cron-only stock sync.
- `order-forward`: cron/webhook-only order forwarding with retry state.
- `fulfillment-retry`: cron-only retry dispatcher, capped at three attempts.
- `tracking-sync`: cron-only CJ tracking/status polling.
- `admin-stock-sync`: admin-authenticated manual stock sync wrapper.
- `admin-fulfillment-retry`: admin-authenticated manual retry wrapper.

Schedule `stock-sync` every 30-60 minutes, `fulfillment-retry` every 5 minutes,
and `tracking-sync` every 15-30 minutes in Supabase Cron. Each request should
include the `x-cron-secret` header. Product import can be invoked manually from
an admin UI or scheduled for a chosen keyword/category; imported rows remain
drafts.

Schedule `stock-sync` every 30-60 minutes in Supabase Dashboard > Integrations >
Cron, sending `POST /functions/v1/stock-sync` with the `x-cron-secret` header.
The product import function can be invoked manually from the admin UI or from
the same scheduler for a chosen keyword/category; imported rows remain drafts.

Deploy with the Supabase CLI after linking the project:

```bash
supabase db push
supabase secrets set CJ_EMAIL=... CJ_OPEN_ID=... CJ_THIRD_ACCOUNT_ID=... CJ_REDIRECT_URI=... FLW_SECRET_KEY=... FLW_WEBHOOK_SECRET_HASH=... CRON_SECRET=...
supabase functions deploy cj-auth
supabase functions deploy create-payment-intent
supabase functions deploy flutterwave-webhook
supabase functions deploy products-sync-status
supabase functions deploy admin-products-import
supabase functions deploy stock-sync
supabase functions deploy order-forward
supabase functions deploy fulfillment-retry
supabase functions deploy tracking-sync
supabase functions deploy admin-stock-sync
supabase functions deploy admin-fulfillment-retry
```
