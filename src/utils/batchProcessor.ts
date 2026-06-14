// p-limit@3.1.0 es CommonJS, usar require para máxima compatibilidad
// @ts-ignore - p-limit@3.1.0 no tiene tipos ESM, pero funciona con CommonJS
const pLimit = require('p-limit');

export interface BatchResult<T> {
  success: T[];
  failed: Array<{ index: number; error: string; error_code?: string; input?: any }>;
  summary: {
    total: number;
    success: number;
    failed: number;
    duration_ms: number;
    success_rate: string;
  };
}

/**
 * Procesa un array en lotes con concurrencia controlada
 * Compatible con CommonJS (p-limit@3.1.0)
 */
export async function processInBatches<T, R>(
  items: T[],
  processor: (item: T, index: number) => Promise<R>,
  options?: {
    batchSize?: number;
    concurrency?: number;
    retryFailed?: boolean;
    maxRetries?: number;
  }
): Promise<BatchResult<R>> {
  const {
    batchSize = 10,
    concurrency = 3,
    retryFailed = false,
    maxRetries = 2,
  } = options || {};

  const startTime = Date.now();
  // p-limit@3.1.0 exporta función directamente, no default export
  const limit = pLimit(concurrency);
  const results: Array<{ index: number; success: boolean; result?: R; error?: string; error_code?: string; input?: T }> = [];

  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    
    const batchPromises = batch.map((item, idx) => {
      const globalIndex = i + idx;
      
      const tryProcess = async (attempt: number): Promise<{ index: number; success: boolean; result?: R; error?: string; error_code?: string; input?: T }> => {
        try {
          const result = await processor(item, globalIndex);
          return { index: globalIndex, success: true, result };
        } catch (err: any) {
          const errorCode = err.errorCode || err.code || 'UNKNOWN_ERROR';
          
          if (retryFailed && attempt < maxRetries && !['VALIDATION_ERROR', 'BRAND_NOT_FOUND', 'CATEGORY_NOT_FOUND'].includes(errorCode)) {
            await new Promise(resolve => setTimeout(resolve, 100 * attempt));
            return tryProcess(attempt + 1);
          }
          
          return {
            index: globalIndex,
            success: false,
            error: err.message || String(err),
            error_code: errorCode,
            input: item,
          };
        }
      };
      
      return limit(() => tryProcess(1));
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    if (i + batchSize < items.length) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
  }

  const successful = results.filter(r => r.success).map(r => r.result!) as R[];
  const failed = results.filter(r => !r.success).map(r => ({
    index: r.index,
    error: r.error!,
    error_code: r.error_code,
    input: r.input,
  }));

  const duration = Date.now() - startTime;
  
  return {
    success: successful,
    failed,
    summary: {
      total: items.length,
      success: successful.length,
      failed: failed.length,
      duration_ms: duration,
      success_rate: `${((successful.length / items.length) * 100).toFixed(1)}%`,
    },
  };
}
