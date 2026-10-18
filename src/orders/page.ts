import { DEFAULT_LIMIT, MAX_LIMIT } from "./list.ts";
import type { Order, OrderStore } from "./store.ts";

export interface OrderPage {
  orders: Order[];
  nextCursor?: string;
}

export interface PageOptions {
  limit?: number;
  cursor?: string;
}

/** Same ordering as `OrderStore.all()`: oldest first, ties broken by id. */
function compare(a: { createdAt: string; id: string }, b: { createdAt: string; id: string }): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function encodeCursor(order: Order): string {
  return Buffer.from(JSON.stringify([order.createdAt, order.id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): { createdAt: string; id: string } {
  const fail = (): never => {
    throw new Error("Invalid cursor");
  };
  if (typeof cursor !== "string" || cursor === "" || !/^[A-Za-z0-9_-]+$/.test(cursor)) return fail();
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    return fail();
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) return fail();
  const [createdAt, id] = parsed as unknown[];
  if (typeof createdAt !== "string" || typeof id !== "string") return fail();
  return { createdAt, id };
}

/**
 * One page of orders, oldest first. The cursor marks a position in the
 * (createdAt, id) order, so orders added between requests do not cause
 * repeats or skips after the cursor.
 */
export function listOrdersPage(store: OrderStore, options: PageOptions = {}): OrderPage {
  const requested = options.limit ?? DEFAULT_LIMIT;
  const limit = Math.min(Math.max(Number.isNaN(requested) ? DEFAULT_LIMIT : Math.trunc(requested), 1), MAX_LIMIT);
  const after = options.cursor === undefined ? undefined : decodeCursor(options.cursor);

  const all = store.all();
  const remaining = after === undefined ? all : all.filter((o) => compare(o, after) > 0);
  const orders = remaining.slice(0, limit);
  const last = orders[orders.length - 1];
  if (last === undefined || remaining.length <= limit) return { orders };
  return { orders, nextCursor: encodeCursor(last) };
}
