# Using ts-mini

## Orders

`listOrders(store)` returns orders oldest first.

`listOrdersPage(store, { limit, cursor })` returns `{ orders, nextCursor }`, one page of orders oldest first (orders with the same `createdAt` are ordered by `id`). `limit` defaults to 20 and is clamped to 1–100; a page holds exactly `limit` orders when enough exist. `nextCursor` is an opaque string that marks the position after the last order returned; pass it back as `cursor` to get the next page. `nextCursor` is absent (`undefined`) once there are no more orders, so a cursor never leads to an empty page. A malformed `cursor` throws an error.

## Sessions

`signSession` and `verifySession` sign a session with an HMAC key the caller provides.

## Discounts

`applyDiscount(totalCents, percent)` returns the discounted total in cents.
