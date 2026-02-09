/**
 * Performance monitoring utilities
 */

export interface PerformanceMetrics {
  query: string;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Decorator to measure function execution time
 */
export function measurePerformance(
  _target: any,
  _propertyName: string,
  descriptor: PropertyDescriptor
) {
  const method = descriptor.value;

  descriptor.value = async function (...args: any[]) {
    const start = Date.now();
    let success = true;
    let error: string | undefined;

    try {
      const result = await method.apply(this, args);
      return result;
    } catch (err: any) {
      success = false;
      error = err?.message || String(err);
      throw err;
    } finally {
      const duration = Date.now() - start;

      // Log slow queries (> 100ms)
      if (duration > 100) {
        console.warn(`[SLOW] ${_propertyName} took ${duration}ms`);
      }

      // Record metrics (if metrics service available)
      if ((global as any).__metricsService) {
        (global as any).__metricsService.record({
          operation: _propertyName,
          duration,
          success,
          error,
        });
      }
    }
  };

  return descriptor;
}

/**
 * Create a timeout promise
 */
export function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Execute with timeout
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string = 'Operation timed out'
): Promise<T> {
  return Promise.race([promise, createTimeout(ms, message)]);
}
