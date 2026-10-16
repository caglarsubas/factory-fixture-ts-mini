# Using ts-mini

## Orders

`listOrders(store, options?)` returns orders oldest first.

The `limit` option caps how many orders are returned:

- The default limit is 20.
- The maximum limit is 100; larger values are clamped to 100.

## Sessions

`signSession` and `verifySession` sign a session with an HMAC key the caller provides.

## Discounts

`applyDiscount(totalCents, percent)` returns the discounted total in cents.
