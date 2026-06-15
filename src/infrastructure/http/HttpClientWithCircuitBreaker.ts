import { CircuitBreaker } from '../resilience/CircuitBreaker';

export class HttpClientWithCircuitBreaker {
  private circuitBreaker: CircuitBreaker;

  constructor(serviceName: string) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 5,
      timeout: 3000,
      resetTimeout: 30000,
      monitorInterval: 10000
    }, serviceName);
  }

  async get<T>(url: string): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });
  }

  async post<T>(url: string, body: any): Promise<T> {
    return this.circuitBreaker.execute(async () => {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response.json();
    });
  }

  getState(): string {
    return this.circuitBreaker.getState();
  }

  getMetrics(): any {
    return this.circuitBreaker.getMetrics();
  }
}
