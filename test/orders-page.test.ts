import assert from "node:assert/strict";
import { test } from "node:test";
import { listOrdersPage, type OrderPage } from "../src/orders/page.ts";
import { OrderStore } from "../src/orders/store.ts";

function store(n: number): OrderStore {
  const s = new OrderStore();
  for (let i = n; i > 0; i--) s.add({ id: `o${String(i)}`, customer: "c", totalCents: 100 * i, createdAt: `2026-01-${String(i).padStart(2, "0")}` });
  return s;
}

/** Many orders, with groups of 5 sharing one createdAt. */
function tiedStore(n: number): OrderStore {
  const s = new OrderStore();
  for (let i = n; i > 0; i--) s.add({ id: `t${String(i).padStart(3, "0")}`, customer: "c", totalCents: i, createdAt: `2026-02-${String(Math.ceil(i / 5)).padStart(2, "0")}` });
  return s;
}

function ids(page: OrderPage): string[] {
  return page.orders.map((o) => o.id);
}

function collect(s: OrderStore, limits: number[]): ReturnType<OrderStore["all"]> {
  const out: ReturnType<OrderStore["all"]> = [];
  let cursor: string | undefined;
  for (let i = 0; i < 1000; i++) {
    const page = listOrdersPage(s, { limit: limits[i % limits.length], cursor });
    out.push(...page.orders);
    if (page.nextCursor === undefined) return out;
    cursor = page.nextCursor;
  }
  throw new Error("did not terminate");
}

test("AC-1 works with no options", () => {
  const page = listOrdersPage(store(3));
  assert.deepEqual(ids(page), ["o1", "o2", "o3"]);
  assert.equal(page.nextCursor, undefined);
});

test("AC-2 first page honours limit", () => {
  assert.deepEqual(ids(listOrdersPage(store(5), { limit: 2 })), ["o1", "o2"]);
});

test("AC-2 default limit is 20", () => {
  assert.equal(listOrdersPage(store(25)).orders.length, 20);
});

test("AC-2 limit below 1 is clamped to 1", () => {
  assert.equal(listOrdersPage(store(5), { limit: 0 }).orders.length, 1);
  assert.equal(listOrdersPage(store(5), { limit: -7 }).orders.length, 1);
});

test("AC-2 limit above max is clamped to 100", () => {
  assert.equal(listOrdersPage(tiedStore(150), { limit: 1000 }).orders.length, 100);
});

test("AC-2 returns exactly limit orders when available", () => {
  assert.equal(listOrdersPage(store(3), { limit: 3 }).orders.length, 3);
});

for (const size of [1, 7, 45]) {
  for (const limit of [1, 3, 20]) {
    test(`AC-3 pages cover store of ${String(size)} with limit ${String(limit)}`, () => {
      for (const s of [store(size), tiedStore(size)]) {
        assert.deepEqual(collect(s, [limit]), s.all());
      }
    });
  }
}

test("AC-3 ties across a page boundary and varying limits", () => {
  const s = tiedStore(45);
  assert.deepEqual(collect(s, [1, 3, 20, 2, 7]), s.all());
  assert.deepEqual(collect(s, [3, 1]), s.all());
  const first = listOrdersPage(s, { limit: 3 });
  // Orders 3 and 4 (0-based 2 and 3) share a createdAt, so the boundary splits a tie.
  assert.equal(s.all()[2]?.createdAt, s.all()[3]?.createdAt);
  assert.equal(first.orders.length, 3);
});

test("AC-4 empty store has no cursor", () => {
  assert.deepEqual(listOrdersPage(new OrderStore()), { orders: [] });
  assert.deepEqual(listOrdersPage(new OrderStore(), { limit: 5 }), { orders: [] });
});

test("AC-4 exact multiple of limit has no trailing empty page", () => {
  const s = store(4);
  const p1 = listOrdersPage(s, { limit: 2 });
  assert.deepEqual(ids(p1), ["o1", "o2"]);
  assert.ok(p1.nextCursor !== undefined);
  const p2 = listOrdersPage(s, { limit: 2, cursor: p1.nextCursor });
  assert.deepEqual(ids(p2), ["o3", "o4"]);
  assert.equal(p2.nextCursor, undefined);
  assert.ok(!("nextCursor" in p2) || p2.nextCursor === undefined);
});

test("AC-4 odd store ends with partial page and no cursor", () => {
  const s = store(5);
  const p1 = listOrdersPage(s, { limit: 2 });
  const p2 = listOrdersPage(s, { limit: 2, cursor: p1.nextCursor });
  assert.deepEqual(ids(p2), ["o3", "o4"]);
  assert.ok(p2.nextCursor !== undefined);
  const p3 = listOrdersPage(s, { limit: 2, cursor: p2.nextCursor });
  assert.deepEqual(ids(p3), ["o5"]);
  assert.equal(p3.nextCursor, undefined);
});

test("AC-5 cursor is a position, not an offset", () => {
  const s = store(6);
  // o1..o6 exist; add an order older than anything seen so far after page 1.
  const p1 = listOrdersPage(s, { limit: 2 });
  assert.deepEqual(ids(p1), ["o1", "o2"]);
  s.add({ id: "old", customer: "c", totalCents: 1, createdAt: "2025-12-31" });
  const p2 = listOrdersPage(s, { limit: 2, cursor: p1.nextCursor });
  assert.deepEqual(ids(p2), ["o3", "o4"]);
});

test("AC-6 malformed cursors throw", () => {
  for (const cursor of ["not-a-cursor", "", "!!!", "e30", Buffer.from("[1,2]").toString("base64url"), Buffer.from('["a"]').toString("base64url")]) {
    assert.throws(() => listOrdersPage(store(3), { cursor }), Error, `cursor ${JSON.stringify(cursor)}`);
  }
});
