# Supplier Pipeline Test Plan

The pipeline is not production-enabled until these tests run against a linked Supabase project and a CJ account with sandbox access.

## Static contract checks

```bash
# From the repository root
node --check js/main.js
node --check js/supabase.js
node --check js/flutterwave.js
```

Confirm the following source contracts before deployment:

- `stock-sync` sets `stock_quantity`, `last_synced_at`, and `is_published` from CJ inventory.
- `order-forward` changes status to `retry_pending` for attempts 1-2 and `fulfillment_failed` at attempt 3.
- Attempt 3 inserts an `admin_alerts` row.
- `flutterwave-webhook` verifies `verif-hash`, transaction status, amount, and currency before inserting an order.
- No browser file contains CJ credentials or calls a CJ URL.

## Supabase/CJ integration tests

1. Configure test-only encrypted secrets and deploy the functions.
2. Import one CJ product as a draft, review its `supplier_product_id` and `supplier_variant_id`, then publish it.
3. Run `stock-sync` with the product's variant mocked or changed to zero inventory. Confirm `stock_quantity = 0`, `is_published = false`, and `sync_status = 'success'`.
4. Restore inventory and run `stock-sync` again. Confirm `is_published = true` and the markup-derived price is restored.
5. Create a Flutterwave test payment intent and deliver its signed webhook. Confirm exactly one paid order and one payment row are created.
6. Confirm the webhook invokes `order-forward`, creates the CJ sandbox order, and stores `supplier_order_id`.
7. Send an invalid-address/order payload. Confirm attempts 1 and 2 schedule retries, attempt 3 sets `fulfillment_failed`, and `admin_alerts` contains one alert.
8. Run `tracking-sync` against the CJ sandbox order and confirm `tracking_number`, `carrier`, and order status update.

The repository currently lacks the Supabase CLI, Deno, a linked project, CJ credentials, and Flutterwave test secrets, so these remote/sandbox checks remain pending and the automation must not be enabled for customers yet.
