// Stratified Memory Visualizer - Main Application

// Configuration
const CONFIG = {
  API_BASE: '/api/memory',
  DEFAULT_TENANT: 'claude-session',
  ANIMATION_DURATION: 2000, // 2 seconds for token counter
  LAYER_DELAY: 400, // 400ms between layer loads
};

// Application State
const state = {
  currentTenant: CONFIG.DEFAULT_TENANT,
  memoryData: null,
  isLoading: false,
  layersLoaded: [],
};

// DOM Elements
const elements = {};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  console.log('Stratified Memory Visualizer initialized');
  // TODO: Cache DOM elements in Phase 2
  // TODO: Load initial data in Phase 2
});

// Placeholder for future functions
// These will be implemented in upcoming tasks

// API Integration (P0-2)
// Note: loadStratifiedMemory is now implemented in api.js
// This is a wrapper that updates app state

async function loadMemoryForTenant(tenantId) {
  if (state.isLoading) {
    console.warn('Already loading, ignoring request');
    return;
  }

  state.isLoading = true;
  showLoadingState();

  try {
    const data = await loadStratifiedMemory(
      tenantId,
      ['metadata', 'reflection', 'recent', 'progressive'],
      3 // recent_count
    );

    state.memoryData = data;
    state.currentTenant = tenantId;
    state.layersLoaded = data.layers_loaded;

    hideLoadingState();
    onDataLoaded(data);

  } catch (error) {
    console.error('Failed to load memory:', error);
    state.isLoading = false;
    hideLoadingState();
    showError(error);
  }
}

// Token Counter Animation (P0-5)
function animateTokenCounter(start, end, duration) {
  console.log('Animating token counter:', start, '→', end);
  // TODO: Implement requestAnimationFrame counter
}

// Layer Loading Animation (P0-6)
function animateLayerLoading() {
  console.log('Starting layer loading animation');
  // TODO: Implement sequential layer loading
}

// Toggle Layer Expansion (P0-7)
function toggleLayer(layerId) {
  console.log('Toggling layer:', layerId);
  // TODO: Implement expand/collapse
}

// Error Handler (P0-9)
function showError(error) {
  const errorContainer = document.getElementById('error-container');
  if (!errorContainer) return;

  let errorMessage = 'An error occurred';
  let errorDetails = '';

  // Determine error type and message
  if (error instanceof TenantNotFoundError) {
    errorMessage = 'Tenant Not Found';
    errorDetails = `The tenant "${state.currentTenant}" does not exist. Please check the tenant ID and try again.`;
  } else if (error instanceof ValidationError) {
    errorMessage = 'Validation Error';
    errorDetails = error.message;
  } else if (error instanceof TimeoutError) {
    errorMessage = 'Request Timeout';
    errorDetails = 'The request took too long to respond. Please try again.';
  } else if (error instanceof ServerError) {
    errorMessage = 'Server Error';
    errorDetails = 'The server encountered an error. Please try again later.';
  } else if (error instanceof APIError) {
    errorMessage = 'API Error';
    errorDetails = error.message;
  } else {
    errorMessage = 'Unexpected Error';
    errorDetails = error.message || 'Unknown error occurred';
  }

  // Update error container
  errorContainer.innerHTML = `
    <div class="bg-red-900/50 border border-red-700 rounded-lg p-6 mb-6">
      <h3 class="text-xl font-bold text-red-400 mb-2">${errorMessage}</h3>
      <p class="text-gray-300 mb-4">${errorDetails}</p>
      ${error instanceof TenantNotFoundError || error instanceof TimeoutError || error instanceof ServerError ? `
        <button onclick="retryLoad()" class="bg-red-700 hover:bg-red-600 px-4 py-2 rounded font-medium transition">
          Try Again
        </button>
      ` : ''}
    </div>
  `;

  errorContainer.classList.remove('hidden');
}

// Retry button handler
function retryLoad() {
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.classList.add('hidden');
  }
  loadMemoryForTenant(state.currentTenant);
}

// Loading State (P0-9)
function showLoadingState() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.remove('hidden');
  }
}

function hideLoadingState() {
  const loadingOverlay = document.getElementById('loading-overlay');
  if (loadingOverlay) {
    loadingOverlay.classList.add('hidden');
  }
}

// Data Loaded Handler (placeholder - will be implemented in P0-6, P0-8, P0-10)
function onDataLoaded(data) {
  console.log('Data loaded, updating UI:', data);
  // TODO: Update UI with loaded data
  // This will be implemented in upcoming tasks:
  // - P0-6: Layer loading animation
  // - P0-8: Format and display layer content
  // - P0-10: Statistics dashboard
}

console.log('App.js loaded. Ready for development.');
