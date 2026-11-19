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

  /**
   * Deletes every stored order with this id (add() does not reject duplicate ids, so this
   * guarantees get(id) is undefined afterwards). Returns true if anything was removed,
   * false (store unchanged) if no order has that id.
   */
  remove(id: string): boolean {
    let removed = false;
    for (let i = this.#orders.length - 1; i >= 0; i--) {
      if (this.#orders[i]?.id === id) {
        this.#orders.splice(i, 1);
        removed = true;
      }
    }
    return removed;
  }

  /** Every order, oldest first; ties broken by id. */
  all(): Order[] {
    return [...this.#orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
  }
}
