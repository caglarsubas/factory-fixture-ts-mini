import assert from "node:assert/strict";
import { test } from "node:test";
import { pageOrders } from "../src/orders/page.ts";
import { OrderStore } from "../src/orders/store.ts";
import type { Order } from "../src/orders/store.ts";

function order(i: number, createdAt?: string): Order {
  return {
    id: `o${String(i).padStart(4, "0")}`,
    customer: "c",
    totalCents: i,
    createdAt: createdAt ?? `2026-01-01T00:${String(Math.floor(i / 60)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}Z`,
  };
}

/** Adds orders in reverse so insertion order differs from sorted order. */
function store(n: number, createdAt?: (i: number) => string): OrderStore {
  const s = new OrderStore();
  for (let i = n; i > 0; i--) s.add(order(i, createdAt?.(i)));
  return s;
}

function ids(orders: Order[]): string[] {
  return orders.map((o) => o.id);
}

test("pageOrders: first page is oldest first and honours limit", () => {
  const s = store(25);
  const all = s.all();
  assert.deepEqual(pageOrders(s).orders, all.slice(0, 20));
  assert.deepEqual(pageOrders(s, { limit: 5 }).orders, all.slice(0, 5));

  const big = store(150);
  assert.deepEqual(pageOrders(big, { limit: 1000 }).orders, big.all().slice(0, 100));
  assert.equal(pageOrders(big, { limit: 100 }).orders.length, 100);

  assert.deepEqual(pageOrders(s, { limit: 0 }).orders, all.slice(0, 1));
  assert.deepEqual(pageOrders(s, { limit: -5 }).orders, all.slice(0, 1));
});

test("pageOrders: following cursors visits every order once in order", () => {
  for (const [n, limit, sameTime] of [
    [47, 10, false],
    [47, 10, true],
    [40, 20, true],
    [101, 7, true],
  ] as const) {
    const s = store(n, sameTime ? (i) => `2026-01-0${String(1 + (i % 3))}` : undefined);
    const seen: Order[] = [];
    let cursor: string | undefined;
    let pages = 0;
    do {
      const opts = cursor === undefined ? { limit } : { limit, cursor };
      const page = pageOrders(s, opts);
      seen.push(...page.orders);
      cursor = page.nextCursor;
      pages++;
      assert.ok(pages <= n, "pagination must terminate");
    } while (cursor !== undefined);
    assert.deepEqual(ids(seen), ids(s.all()));
  }
});

test("pageOrders: no cursor when there are no more orders", () => {
  assert.equal(pageOrders(new OrderStore()).nextCursor, undefined);
  assert.deepEqual(pageOrders(new OrderStore()).orders, []);
  assert.equal(pageOrders(store(5)).nextCursor, undefined);

  const s = store(40);
  const p1 = pageOrders(s, { limit: 20 });
  assert.equal(p1.orders.length, 20);
  assert.equal(typeof p1.nextCursor, "string");
  assert.ok((p1.nextCursor ?? "").length > 0);
  const p2 = pageOrders(s, { limit: 20, cursor: p1.nextCursor as string });
  assert.equal(p2.orders.length, 20);
  assert.equal(p2.nextCursor, undefined);

  const exact = pageOrders(store(20), { limit: 20 });
  assert.equal(exact.orders.length, 20);
  assert.equal(exact.nextCursor, undefined);
});

test("pageOrders: cursor is stable when older orders are added", () => {
  const s = new OrderStore();
  for (let i = 10; i <= 40; i++) s.add(order(i));
  const p1 = pageOrders(s, { limit: 10 });
  assert.ok(p1.nextCursor !== undefined);
  const firstIds = new Set(ids(p1.orders));
  const remaining = ids(s.all()).filter((id) => !firstIds.has(id));

  // Older orders sort before the cursor position.
  s.add(order(1));
  s.add(order(2));
  s.add({ ...order(3), createdAt: "2025-12-31" });

  const rest: string[] = [];
  let cursor: string | undefined = p1.nextCursor;
  while (cursor !== undefined) {
    const page = pageOrders(s, { limit: 10, cursor });
    rest.push(...ids(page.orders));
    cursor = page.nextCursor;
  }
  assert.deepEqual(rest, remaining);
  assert.ok(rest.every((id) => !firstIds.has(id)));
});

test("pageOrders: rejects a malformed cursor", () => {
  const s = store(5);
  const good = pageOrders(store(30), { limit: 5 }).nextCursor as string;
  const b64 = (v: unknown): string => Buffer.from(JSON.stringify(v)).toString("base64url");
  for (const cursor of [
    "not-a-cursor",
    "",
    "!!!!",
    good + "x",
    good + "=",
    b64({ a: 1 }),
    b64(["2026-01-01"]),
    b64([1, 2]),
    b64(["a", "b", "c"]),
    Buffer.from("not json").toString("base64url"),
  ]) {
    assert.throws(() => pageOrders(s, { cursor }), RangeError, `cursor ${JSON.stringify(cursor)}`);
  }
});
