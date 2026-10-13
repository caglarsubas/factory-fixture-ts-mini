import assert from "node:assert/strict";
import { test } from "node:test";
import { listOrdersPage } from "../src/orders/list.ts";
import { OrderStore } from "../src/orders/store.ts";

function store(n: number): OrderStore {
  const s = new OrderStore();
  for (let i = n; i > 0; i--) {
    s.add({ id: `o${String(i)}`, customer: "c", totalCents: i, createdAt: new Date(Date.UTC(2026, 0, 1) + i * 60000).toISOString() });
  }
  return s;
}

test("walks multiple pages with no gaps or duplicates", () => {
  const s = store(45);
  const p1 = listOrdersPage(s, { limit: 20 });
  assert.equal(p1.orders.length, 20);
  assert.equal(typeof p1.nextCursor, "string");
  const p2 = listOrdersPage(s, { limit: 20, cursor: p1.nextCursor });
  assert.equal(p2.orders.length, 20);
  assert.equal(typeof p2.nextCursor, "string");
  const p3 = listOrdersPage(s, { limit: 20, cursor: p2.nextCursor });
  assert.equal(p3.orders.length, 5);
  assert.equal(p3.nextCursor, undefined);
  assert.deepEqual([...p1.orders, ...p2.orders, ...p3.orders].map((o) => o.id), s.all().map((o) => o.id));
});

test("exact multiple of the limit leaves no cursor on the last page", () => {
  const s = store(40);
  const p1 = listOrdersPage(s, { limit: 20 });
  const p2 = listOrdersPage(s, { limit: 20, cursor: p1.nextCursor });
  assert.equal(p2.orders.length, 20);
  assert.equal(p2.nextCursor, undefined);
});

test("an empty store returns no orders and no cursor", () => {
  const e = listOrdersPage(new OrderStore());
  assert.deepEqual(e.orders, []);
  assert.equal(e.nextCursor, undefined);
});

test("limit defaults to 20 and is clamped to [1, 100]", () => {
  const s = store(150);
  assert.equal(listOrdersPage(s).orders.length, 20);
  assert.equal(listOrdersPage(s, { limit: 0 }).orders.length, 1);
  assert.equal(listOrdersPage(s, { limit: 1000 }).orders.length, 100);
});

test("ties on createdAt page in id order", () => {
  const s = new OrderStore();
  for (const id of ["b", "e", "a", "d", "c"]) s.add({ id, customer: "c", totalCents: 1, createdAt: "2026-01-01T00:00:00.000Z" });
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const p = listOrdersPage(s, { limit: 2, cursor });
    ids.push(...p.orders.map((o) => o.id));
    cursor = p.nextCursor;
  } while (cursor !== undefined);
  assert.deepEqual(ids, ["a", "b", "c", "d", "e"]);
});

test("cursor is position based, not an offset", () => {
  const s = store(10);
  const p1 = listOrdersPage(s, { limit: 5 });
  s.add({ id: "old", customer: "c", totalCents: 1, createdAt: "2025-01-01T00:00:00.000Z" });
  const p2 = listOrdersPage(s, { limit: 5, cursor: p1.nextCursor });
  assert.deepEqual(p2.orders.map((o) => o.id), ["o6", "o7", "o8", "o9", "o10"]);
  assert.equal(p2.nextCursor, undefined);
});

test("an invalid cursor throws", () => {
  const s = store(3);
  assert.throws(() => listOrdersPage(s, { cursor: "not-a-cursor" }));
  assert.throws(() => listOrdersPage(s, { cursor: "%%%" }));
  assert.throws(() => listOrdersPage(s, { cursor: "" }));
});
