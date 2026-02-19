// Stratified Memory Visualizer - API Integration Layer
// Task P0-2: API Integration with retry logic, timeout, error handling

/**
 * Determine API base URL based on current origin
 * Uses the same host as the page to avoid CORS issues
 */
const API_BASE_URL = `${window.location.protocol}//${window.location.hostname}:3456`;

/**
 * Fetch with exponential backoff retry
 * @param {string} url - API endpoint
 * @param {object} options - Fetch options
 * @param {number} retries - Number of retries (default: 3)
 * @returns {Promise<Response>} - Fetch response
 */
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      // Don't retry on client errors (4xx)
      if (response.status >= 400 && response.status < 500) {
        return response;
      }

      // Retry on server errors (5xx) or network errors
      if (response.ok || i === retries - 1) {
        return response;
      }

      // Exponential backoff: 1s, 2s, 4s
      const backoffDelay = Math.pow(2, i) * 1000;
      console.log(`Retry ${i + 1}/${retries} after ${backoffDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));

    } catch (error) {
      // Network error (no response)
      if (i === retries - 1) throw error;

      // Exponential backoff
      const backoffDelay = Math.pow(2, i) * 1000;
      console.log(`Network error, retry ${i + 1}/${retries} after ${backoffDelay}ms`);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
}

/**
 * Validate stratified memory API response
 * @param {object} data - Response data from API
 * @returns {object} - Validated data
 * @throws {Error} - If validation fails
 */
function validateStratifiedResponse(data) {
  // Check top-level structure
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid response: Not an object');
  }

  if (data.success !== true) {
    throw new Error('API returned success: false');
  }

  if (typeof data.estimated_tokens !== 'number') {
    throw new Error('Invalid response: missing or invalid estimated_tokens');
  }

  if (!Array.isArray(data.layers_loaded)) {
    throw new Error('Invalid response: missing or invalid layers_loaded');
  }

  // Validate metadata if present
  if (data.metadata) {
    if (typeof data.metadata.session_count === 'undefined') {
      throw new Error('Invalid response: metadata missing session_count');
    }
  }

  // Validate reflection if present
  if (data.reflection) {
    if (!data.reflection.type) {
      throw new Error('Invalid response: reflection missing type');
    }
  }

  // Validate recent if present
  if (data.recent) {
    if (!Array.isArray(data.recent)) {
      throw new Error('Invalid response: recent should be an array');
    }
  }

  // Validate progressive if present
  if (data.progressive) {
    if (typeof data.progressive !== 'object') {
      throw new Error('Invalid response: progressive should be an object');
    }
  }

  return data;
}

/**
 * Load stratified memory for a tenant
 * @param {string} tenantId - Tenant identifier
 * @param {array} layers - Layers to load (default: all 4)
 * @param {number} recentCount - Number of recent handoffs (default: 3)
 * @param {string} topic - Optional topic for progressive layer
 * @returns {Promise<object>} - Validated stratified memory data
 */
async function loadStratifiedMemory(
  tenantId,
  layers = ['metadata', 'reflection', 'recent', 'progressive'],
  recentCount = 3,
  topic = undefined
) {
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
        }),
        signal: controller.signal
      },
      3 // 3 retries
    );

    clearTimeout(timeoutId);

    // Handle HTTP errors
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

    // Validate response structure
    const validatedData = validateStratifiedResponse(data);

    console.log('Stratified memory loaded successfully:', {
      tenant: validatedData.tenant_id,
      layers: validatedData.layers_loaded,
      tokens: validatedData.estimated_tokens,
      compression: validatedData.compression_ratio
    });

    return validatedData;

  } catch (error) {
    clearTimeout(timeoutId);

    // Handle specific error types
    if (error.name === 'AbortError') {
      throw new TimeoutError('Request timed out after 5 seconds');
    }

    // Re-throw custom errors
    if (error instanceof ValidationError ||
        error instanceof TenantNotFoundError ||
        error instanceof ServerError ||
        error instanceof TimeoutError) {
      throw error;
    }

    // Unknown error
    throw new APIError(error.message, { originalError: error.message });
  }
}

/**
 * Get compression statistics for a tenant
 * @param {string} tenantId - Tenant identifier
 * @returns {Promise<object>} - Compression statistics
 */
async function getCompressionStats(tenantId) {
  try {
    const url = `/api/memory/compression-stats?tenant_id=${encodeURIComponent(tenantId)}`;
    const response = await fetchWithRetry(url, { method: 'GET' }, 2);

    if (!response.ok) {
      throw new APIError(`Failed to fetch compression stats: HTTP ${response.status}`);
    }

    return await response.json();

  } catch (error) {
    console.error('Error fetching compression stats:', error);
    throw error;
  }
}

// Custom Error Classes

class APIError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'APIError';
    this.details = details;
  }
}

class ValidationError extends APIError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ValidationError';
  }
}

class TenantNotFoundError extends APIError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'TenantNotFoundError';
  }
}

class ServerError extends APIError {
  constructor(message, details = {}) {
    super(message, details);
    this.name = 'ServerError';
  }
}

class TimeoutError extends APIError {
  constructor(message) {
    super(message);
    this.name = 'TimeoutError';
  }
}

// Export for use in app.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadStratifiedMemory,
    getCompressionStats,
    APIError,
    ValidationError,
    TenantNotFoundError,
    ServerError,
    TimeoutError
  };
}
