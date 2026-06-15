export interface DomainEvent {
  id: string;
  type: string;
  aggregateId: string;
  occurredAt: Date;
  version: number;
  payload: Record<string, any>;
}

export abstract class BaseDomainEvent implements DomainEvent {
  public readonly id: string;
  public readonly occurredAt: Date;
  public readonly version: number = 1;

  constructor(
    public readonly type: string,
    public readonly aggregateId: string,
    public readonly payload: Record<string, any>
  ) {
    this.id = crypto.randomUUID();
    this.occurredAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      type: this.type,
      aggregateId: this.aggregateId,
      occurredAt: this.occurredAt.toISOString(),
      version: this.version,
      payload: this.payload
    };
  }
}
