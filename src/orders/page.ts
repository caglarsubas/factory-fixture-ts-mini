import { DEFAULT_LIMIT, MAX_LIMIT } from "./list.ts";
import type { Order, OrderStore } from "./store.ts";

export interface PageOptions {
  limit?: number;
  cursor?: string;
}

export interface OrderPage {
  orders: Order[];
  nextCursor?: string;
}

/** Same ordering as `OrderStore.all()`: createdAt ascending, ties broken by id. */
function compareKey(aCreatedAt: string, aId: string, bCreatedAt: string, bId: string): number {
  return aCreatedAt.localeCompare(bCreatedAt) || aId.localeCompare(bId);
}

function encodeCursor(order: Order): string {
  return Buffer.from(JSON.stringify([order.createdAt, order.id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const bad = (): RangeError => new RangeError("Invalid cursor");
  if (cursor === "") throw bad();
  let parsed: unknown;
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf8");
    parsed = JSON.parse(json);
  } catch {
    throw bad();
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw bad();
  const [createdAt, id] = parsed as unknown[];
  if (typeof createdAt !== "string" || typeof id !== "string") throw bad();
  // Reject anything pageOrders could not have produced (non-canonical encodings).
  if (encodeCursor({ createdAt, id } as Order) !== cursor) throw bad();
  return { createdAt, id };
}

/**
 * Returns one oldest-first page of orders. `nextCursor` is an opaque keyset
 * cursor (position of the last returned order); it is absent on the last page.
 */
export function pageOrders(store: OrderStore, options: PageOptions = {}): OrderPage {
  const requested = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(Number.isNaN(requested) ? DEFAULT_LIMIT : Math.floor(requested), 1), MAX_LIMIT);

  let orders = store.all();
  if (options.cursor !== undefined) {
    const after = decodeCursor(options.cursor);
    orders = orders.filter((o) => compareKey(o.createdAt, o.id, after.createdAt, after.id) > 0);
  }

  const page = orders.slice(0, limit);
  const last = page[page.length - 1];
  if (last !== undefined && orders.length > page.length) {
    return { orders: page, nextCursor: encodeCursor(last) };
  }
  return { orders: page };
}
