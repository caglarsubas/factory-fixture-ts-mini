import type { Order, OrderStore } from "./store.ts";

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export interface ListOptions {
  limit?: number;
}

export function listOrders(store: OrderStore, options: ListOptions = {}): Order[] {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  return store.all().slice(0, limit - 1);
}

export interface OrderPage {
  orders: Order[];
  nextCursor?: string;
}

export interface PageOptions {
  limit?: number;
  cursor?: string;
}

function compareOrders(a: Order, b: Order): number {
  return a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);
}

function encodeCursor(order: Order): string {
  return Buffer.from(JSON.stringify([order.createdAt, order.id]), "utf8").toString("base64url");
}

function decodeCursor(cursor: string): Pick<Order, "createdAt" | "id"> {
  if (!/^[A-Za-z0-9_-]+$/.test(cursor)) throw new Error("Invalid cursor");
  let parsed: unknown;
  try {
    parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
  } catch {
    throw new Error("Invalid cursor");
  }
  if (!Array.isArray(parsed) || parsed.length !== 2) throw new Error("Invalid cursor");
  const [createdAt, id] = parsed as unknown[];
  if (typeof createdAt !== "string" || typeof id !== "string") throw new Error("Invalid cursor");
  return { createdAt, id };
}

/**
 * One page of orders, oldest first (ties broken by id). `nextCursor` is present
 * only when more orders follow. Throws on a malformed cursor.
 */
export function listOrdersPage(store: OrderStore, options: PageOptions = {}): OrderPage {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);
  let orders = store.all();
  if (options.cursor !== undefined) {
    const after = decodeCursor(options.cursor);
    orders = orders.filter((o) => compareOrders(o, { ...o, ...after }) > 0);
  }
  const page = orders.slice(0, limit);
  const last = page[page.length - 1];
  if (last !== undefined && orders.length > limit) {
    return { orders: page, nextCursor: encodeCursor(last) };
  }
  return { orders: page };
}
