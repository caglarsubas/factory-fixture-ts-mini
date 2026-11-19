import assert from "node:assert/strict";
import { test } from "node:test";
import { type Order, OrderStore } from "../src/orders/store.ts";

const orders: Order[] = [
  { id: "b", customer: "c2", totalCents: 200, createdAt: "2026-01-02" },
  { id: "c", customer: "c3", totalCents: 300, createdAt: "2026-01-01" },
  { id: "a", customer: "c1", totalCents: 100, createdAt: "2026-01-01" },
];

function filled(): OrderStore {
  const s = new OrderStore();
  for (const o of orders) s.add(o);
  return s;
}

test("get returns the order with that id", () => {
  const s = filled();
  for (const o of orders) {
    const found = s.get(o.id);
    assert.deepEqual(found, o);
    assert.equal(found?.id, o.id);
    assert.equal(found?.customer, o.customer);
    assert.equal(found?.totalCents, o.totalCents);
    assert.equal(found?.createdAt, o.createdAt);
  }
});

test("get returns undefined for a missing id", () => {
  assert.strictEqual(filled().get("missing"), undefined);
});

test("get returns undefined on an empty store", () => {
  assert.strictEqual(new OrderStore().get("a"), undefined);
});

test("get does not change ordering", () => {
  const s = filled();
  const before = s.all().map((o) => o.id);
  assert.deepEqual(before, ["a", "c", "b"]);
  for (const id of ["b", "missing", "a", "c", "b", "nope"]) s.get(id);
  assert.deepEqual(s.all().map((o) => o.id), before);
  assert.deepEqual(s.all(), [orders[2], orders[1], orders[0]]);
});

test("remove deletes the order with that id and returns true", () => {
  const s = filled();
  assert.strictEqual(s.remove("b"), true);
  assert.strictEqual(s.get("b"), undefined);
  assert.ok(!s.all().some((o) => o.id === "b"));
  assert.equal(s.all().length, 2);
});

test("remove returns false for a missing id", () => {
  const s = filled();
  const before = s.all();
  assert.strictEqual(s.remove("missing"), false);
  assert.deepEqual(s.all(), before);
});

test("remove returns false on an empty store", () => {
  assert.strictEqual(new OrderStore().remove("a"), false);
});

test("remove keeps remaining orders oldest first", () => {
  const s = filled();
  assert.strictEqual(s.remove("c"), true);
  assert.deepEqual(s.all().map((o) => o.id), ["a", "b"]);
  assert.strictEqual(s.remove("c"), false);
  assert.deepEqual(s.all().map((o) => o.id), ["a", "b"]);
});
