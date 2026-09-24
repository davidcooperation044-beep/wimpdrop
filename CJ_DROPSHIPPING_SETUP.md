# CJ DROPSHIPPING INTEGRATION - STAGE 0 DIAGNOSIS

**Status**: Direct client-side integration retired
**Last checked**: 2026-09-24

## Findings

The previous guide described a `js/api/cj-dropshipping.js` client module, but that file is not present and no HTML page loads it. The old guide also embedded a CJ credential and documented direct browser calls. That approach is unsafe and does not match CJ's current OAuth flow or endpoint contract.

The exposed CJ credential was removed from this repository. Treat it as compromised and rotate or revoke it in the CJ dashboard before creating a replacement secret.

There is currently no CJ credential in `.env.local`, no `VITE_CJ_API_KEY` in client code, and no browser-side CJ API module.

## Current Official API Notes

Sources checked:

- [CJ OAuth authorization](https://developers.cjdropshipping.com/en/api/api2/api/authorize_new.html)
- [CJ products and inventory](https://developers.cjdropshipping.com/en/api/api2/api/product.html)
- [CJ shopping and orders](https://developers.cjdropshipping.com/en/api/api2/api/shopping.html)

Authentication is an OAuth-style flow, not a permanent browser API key:

1. `POST /api2.0/v1/authorization/startSession` starts authorization.
2. `POST /api2.0/v1/authentication/getAccessToken` completes authorization and returns `accessToken` and `refreshToken` after the CJ authorization redirect.
3. `POST /api2.0/v1/authentication/refreshAccessToken` accepts `{ "refreshToken": "..." }` and returns replacement access and refresh tokens.
4. Authenticated API calls send `CJ-Access-Token: <accessToken>`.
5. CJ documents a default 180-day lifetime for both access and refresh tokens. A refresh-token expiry requires authorization again.

Relevant current endpoints:

- Product search/list: `GET /api2.0/v1/product/listV2` with `keyWord`, pagination, category, country, price, and filter parameters.
- Product detail: `GET /api2.0/v1/product/query` with one of `pid`, `productSku`, or `variantSku`.
- Variant stock: `GET /api2.0/v1/product/stock/queryByVid?vid=...`.
- SKU/SPU stock: `GET /api2.0/v1/product/stock/queryBySku?sku=...`.
- Product inventory: `GET /api2.0/v1/product/stock/getInventoryByPid?pid=...`.
- Create order: `POST /api2.0/v1/shopping/order/createOrderV2` or `createOrderV3`, using `vid` and `quantity` line items plus shipping fields. CJ's current docs recommend the newer V3 flow for supported integrations.
- Order detail/list: `/api2.0/v1/shopping/order/list` and `/api2.0/v1/shopping/order/getOrderDetail`.
- Tracking/logistics: `GET /api2.0/v1/shopping/order/getOrderLogisticsInfo?orderCode=...`.
- CJ sandbox helpers exist under `/api2.0/v1/shopping/sandbox/`, including simulate-pay and status-update endpoints.

Rate-limit notes published in the current documentation:

- Product calls: `30 requests/second/app`.
- Some order retrieval endpoints: `2 requests/second/account`.
- The product-list documentation also retains a free-user/v1 note limiting product-list calls to `1,000 requests/day`; this account-plan rule should be verified in the CJ account before scheduling imports.
- Responses include CJ error codes such as `1600200` for rate-limit exceeded and `1600000` for a temporary busy/internal retrieval failure. Retries must honor backoff and must not interpret a temporary empty result as no inventory.

## Stage 0 Decision

All CJ communication must move behind Supabase Edge Functions. The browser will call internal Supabase functions only. CJ access and refresh tokens, CJ account identifiers, and any platform token will be stored as Supabase encrypted secrets. The client will never receive or store a CJ credential.

The next implementation stage should create a CJ auth/token function, then thin internal product, stock, import, order-forwarding, and tracking functions. Product and order code should use a supplier adapter rather than CJ-specific calls.

## Removed Material

- Deleted the obsolete client-side integration reference because `js/api/cj-dropshipping.js` was absent.
- Removed the exposed CJ credential from this guide.
- Removed all client-side `VITE_CJ_API_KEY` configuration.
