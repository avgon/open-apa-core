export interface AuditStore<TEvent> {
  append(event: TEvent): void;
  list(): readonly TEvent[];
}

/**
 * Default development adapter. Production adapters can persist the same
 * contract to a database, event stream, or immutable object store.
 */
export class InMemoryAuditStore<TEvent> implements AuditStore<TEvent> {
  private readonly events: TEvent[] = [];

  append(event: TEvent): void {
    this.events.push(Object.freeze({ ...event }));
  }

  list(): readonly TEvent[] {
    return [...this.events];
  }
}
