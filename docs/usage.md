# Using ts-mini

## Orders

`listOrders(store, options?)` returns orders oldest first.

The `limit` option caps how many orders are returned:

- The default limit is 20.
- The maximum limit is 100; larger values are clamped to 100.

### Paging through orders

`pageOrders(store, options?)` returns `{ orders, nextCursor? }`: one page of orders, oldest first
(same order as `OrderStore.all()`: `createdAt` ascending, ties broken by id). Unlike `listOrders`,
it can be followed page by page.

Options:

- `limit`: page size. The default is 20; values are clamped to between 1 and 100.
- `cursor`: the `nextCursor` returned by a previous call. Omit it to get the first page.

`nextCursor` is absent on the last page (including when the store is empty). Cursors are opaque:
do not parse or build them, only pass back what `pageOrders` returned. A cursor marks the position
of the last order returned, so orders added before that position do not cause repeats or skips.
A malformed cursor makes `pageOrders` throw a `RangeError`.

```ts
let page = pageOrders(store, { limit: 50 });
while (true) {
  handle(page.orders);
  if (page.nextCursor === undefined) break;
  page = pageOrders(store, { limit: 50, cursor: page.nextCursor });
}
```

## Sessions

`signSession` and `verifySession` sign a session with an HMAC key the caller provides.

## Discounts

`applyDiscount(totalCents, percent)` returns the discounted total in cents.
