// API Configuration
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3456`;

// Custom error classes
class APIError extends Error {
  constructor(message: string, public data?: any) {
    super(message);
    this.name = 'APIError';
  }
}

class ValidationError extends APIError {
  constructor(message: string, data?: any) {
    super(message, data);
    this.name = 'ValidationError';
  }
}

class TenantNotFoundError extends APIError {
  constructor(message: string, data?: any) {
    super(message, data);
    this.name = 'TenantNotFoundError';
  }
}

class ServerError extends APIError {
  constructor(message: string, data?: any) {
    super(message, data);
    this.name = 'ServerError';
  }
}

class TimeoutError extends APIError {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

interface LayerData {
  type: string;
  content: any;
  token_count?: number;
}

interface StratifiedMemoryResponse {
  success: boolean;
  tenant_id: string;
  layers_loaded: string[];
  estimated_tokens: number;
  metadata: any;
  layers: {
    metadata?: LayerData;
    reflection?: LayerData;
    recent?: LayerData;
    progressive?: LayerData;
  };
  compression_ratio?: number;
}

interface WakeUpStratifiedRequest {
  tenant_id: string;
  layers: string[];
  recent_count?: number;
  topic?: string;
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      if (response.ok || i === retries - 1) {
        return response;
      }

      const backoffDelay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

    } catch (error) {
      if (i === retries - 1) throw error;
      const backoffDelay = Math.pow(2, i) * 1000;
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  throw new Error('Max retries exceeded');
}

function validateStratifiedResponse(data: any): StratifiedMemoryResponse {
  if (!data || typeof data !== 'object') {
    throw new ValidationError('Invalid response: not an object');
  }

  if (!data.success) {
    throw new ValidationError(data.error || 'API request failed');
  }

  if (!data.tenant_id) {
    throw new ValidationError('Missing tenant_id in response');
  }

  if (!Array.isArray(data.layers_loaded)) {
    throw new ValidationError('Invalid layers_loaded in response');
  }

  if (typeof data.estimated_tokens !== 'number') {
    throw new ValidationError('Invalid estimated_tokens in response');
  }

  return data as StratifiedMemoryResponse;
}

export async function loadStratifiedMemory(
  tenantId: string,
  layers: string[] = ['metadata', 'reflection', 'recent', 'progressive'],
  recentCount = 3,
  topic: string | undefined = undefined
): Promise<StratifiedMemoryResponse> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 5000);

  try {
    console.log(`Loading stratified memory for tenant: ${tenantId}`);

    const response = await fetchWithRetry(
      `${API_BASE_URL}/api/memory/wake-up-stratified`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          tenant_id: tenantId,
          layers: layers,
          recent_count: recentCount,
          topic: topic
        } as WakeUpStratifiedRequest),
        signal: controller.signal
      },
      3
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));

      if (response.status === 400) {
        throw new ValidationError(errorData.error || 'Bad request', errorData);
      }

      if (response.status === 404) {
        throw new TenantNotFoundError(errorData.error || 'Tenant not found', errorData);
      }

      if (response.status === 500) {
        throw new ServerError('Server error, please try again', errorData);
      }

      throw new APIError(`HTTP ${response.status}: ${response.statusText}`, errorData);
    }

    const data = await response.json();
    const validatedData = validateStratifiedResponse(data);

    console.log('Stratified memory loaded successfully:', {
      tenant: validatedData.tenant_id,
      layers: validatedData.layers_loaded,
      tokens: validatedData.estimated_tokens,
      compression: validatedData.compression_ratio
    });

    return validatedData;

  } catch (error: any) {
    clearTimeout(timeoutId);

    if (error.name === 'AbortError') {
      throw new TimeoutError('Request timed out after 5 seconds');
    }

    if (error instanceof ValidationError ||
        error instanceof TenantNotFoundError ||
        error instanceof ServerError ||
        error instanceof TimeoutError) {
      throw error;
    }

    throw new APIError(error.message, { originalError: error.message });
  }
}

export { APIError, ValidationError, TenantNotFoundError, ServerError, TimeoutError };
