export interface CircuitBreakerOptions {
  failureThreshold: number;
  timeout: number;
  resetTimeout: number;
  monitorInterval: number;
}

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failures: number = 0;
  private lastFailureTime: number = 0;
  private halfOpenSuccesses: number = 0;
  
  constructor(
    private readonly options: CircuitBreakerOptions,
    private readonly name: string = 'default'
  ) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.isOpen()) {
      if (this.shouldAttemptReset()) {
        this.transitionToHalfOpen();
      } else {
        throw new Error(`Circuit breaker '${this.name}' is OPEN`);
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private isOpen(): boolean {
    if (this.state === CircuitState.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.options.resetTimeout) {
        return false;
      }
      return true;
    }
    return false;
  }

  private shouldAttemptReset(): boolean {
    const now = Date.now();
    return now - this.lastFailureTime >= this.options.resetTimeout;
  }

  private transitionToHalfOpen(): void {
    this.state = CircuitState.HALF_OPEN;
    this.halfOpenSuccesses = 0;
    console.log(`🔄 Circuit breaker '${this.name}' transitioned to HALF_OPEN`);
  }

  private onSuccess(): void {
    if (this.state === CircuitState.HALF_OPEN) {
      this.halfOpenSuccesses++;
      if (this.halfOpenSuccesses >= this.options.failureThreshold / 2) {
        this.reset();
      }
    }
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailureTime = Date.now();
    
    if (this.state === CircuitState.CLOSED && this.failures >= this.options.failureThreshold) {
      this.transitionToOpen();
    } else if (this.state === CircuitState.HALF_OPEN) {
      this.transitionToOpen();
    }
  }

  private transitionToOpen(): void {
    this.state = CircuitState.OPEN;
    console.error(`🔌 Circuit breaker '${this.name}' OPEN - blocking calls`);
  }

  private reset(): void {
    this.state = CircuitState.CLOSED;
    this.failures = 0;
    console.log(`✅ Circuit breaker '${this.name}' RESET to CLOSED`);
  }

  getState(): CircuitState {
    return this.state;
  }

  getMetrics(): { state: CircuitState; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }
}
