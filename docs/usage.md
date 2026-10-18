# Using ts-mini

## Orders

`listOrders(store, { limit })` returns orders oldest first. The `limit` option is optional. Its default is 20 and its maximum is 100; values outside the range are clamped to 1–100.

Note that `listOrders` currently returns one fewer order than the effective limit: at most 19 orders by default and at most 99 orders at the maximum limit (and none for `limit: 1`). This documents the current behaviour, which looks like an off-by-one bug and may change in a future fix.

### Paginated listing

`listOrdersPage(store, { limit, cursor })` returns `{ orders, nextCursor? }`, one page of orders oldest first (ties broken by id).

- `limit` defaults to 20 and is clamped to the range 1 to 100. Unlike `listOrders`, a page holds exactly `limit` orders when that many remain.
- `nextCursor` is an opaque string. Pass it back as `cursor` to get the next page. It is absent on the last page, including when the last page is exactly full, and for an empty store.
- The cursor marks a position in the (createdAt, id) order rather than an offset, so orders added between requests do not cause repeats or skips after the cursor. You may change `limit` between calls.
- An invalid cursor (malformed, empty or unparseable) throws an `Error`; it never silently returns the first page.

```ts
let page = listOrdersPage(store, { limit: 50 });
while (page.nextCursor !== undefined) {
  page = listOrdersPage(store, { limit: 50, cursor: page.nextCursor });
}
```

## Sessions

`signSession` and `verifySession` sign a session with an HMAC key the caller provides.

## Discounts

`applyDiscount(totalCents, percent)` returns the discounted total in cents.
