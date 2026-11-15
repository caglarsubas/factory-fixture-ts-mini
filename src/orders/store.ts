export interface Order {
  id: string;
  customer: string;
  totalCents: number;
  createdAt: string;
}

export class OrderStore {
  readonly #orders: Order[] = [];

  add(order: Order): void {
    this.#orders.push(order);
  }

  /** The stored order with this id, or undefined if there is none. Does not affect ordering. */
  get(id: string): Order | undefined {
    return this.#orders.find((o) => o.id === id);
  }

  /** Every order, oldest first; ties broken by id. */
  all(): Order[] {
    return [...this.#orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
}
