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
  expandedLayer: null, // Track which layer is expanded
};

// DOM Elements
const elements = {
  connectionIndicator: null,
  connectionText: null,
  statsBar: null,
  layersContainer: null,
  liveRegion: null,
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
  console.log('Stratified Memory Visualizer initialized');

  // Cache DOM elements
  cacheElements();

  // Load initial data
  loadMemoryForTenant(CONFIG.DEFAULT_TENANT);
});

/**
 * Cache DOM elements for performance
 */
function cacheElements() {
  elements.connectionIndicator = document.getElementById('connection-indicator');
  elements.connectionText = document.getElementById('connection-text');
  elements.liveRegion = document.getElementById('live-region');
}

/**
 * Load memory for tenant (wrapper for API call)
 */
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

    updateConnectionStatus(true);
    hideLoadingState();
    onDataLoaded(data);

  } catch (error) {
    console.error('Failed to load memory:', error);
    state.isLoading = false;
    updateConnectionStatus(false);
    hideLoadingState();
    showError(error);
  }
}

/**
 * Update connection status indicator
 */
function updateConnectionStatus(connected) {
  if (connected) {
    elements.connectionIndicator.className = 'w-3 h-3 rounded-full bg-green-500 pulse';
    elements.connectionText.textContent = 'Connected';
    elements.connectionText.className = 'text-sm text-green-400';
  } else {
    elements.connectionIndicator.className = 'w-3 h-3 rounded-full bg-red-500';
    elements.connectionText.textContent = 'Error';
    elements.connectionText.className = 'text-sm text-red-400';
  }
}

/**
 * Handle data loaded - trigger animations and update UI
 */
function onDataLoaded(data) {
  console.log('Data loaded, updating UI:', data);

  // Calculate statistics
  const stats = calculateStatistics(data);

  // Update statistics dashboard (P0-10)
  updateStatisticsDashboard(stats);

  // Start layer loading animation (P0-6)
  animateLayerLoading(data);

  // Start token counter animation (P0-5)
  animateTokenCounter(stats.tokensBefore, stats.tokensAfter, CONFIG.ANIMATION_DURATION);

  // Show replay button after animation
  setTimeout(() => {
    const replayButton = document.getElementById('replay-button');
    if (replayButton) {
      replayButton.classList.remove('hidden');
    }
  }, CONFIG.ANIMATION_DURATION + (data.layers_loaded.length * CONFIG.LAYER_DELAY));
}

/**
 * Calculate statistics from API response
 */
function calculateStatistics(data) {
  const sessionCount = parseInt(data.metadata?.session_count || '0');
  const avgHandoffSize = 800; // ~800 tokens per full handoff
  const tokensBefore = sessionCount * avgHandoffSize;
  const tokensAfter = data.estimated_tokens;
  const compressionRatio = tokensBefore > 0 ? (tokensBefore / tokensAfter).toFixed(1) : '1.0';
  const savingsPercent = tokensBefore > 0
    ? Math.round((1 - tokensAfter / tokensBefore) * 100)
    : 0;

  // Calculate identity age
  const firstSession = data.metadata?.first_session;
  const lastSession = data.metadata?.last_session;
  let ageDays = 0;
  if (firstSession && lastSession) {
    const first = new Date(firstSession);
    const last = new Date(lastSession);
    ageDays = Math.ceil((last - first) / (1000 * 60 * 60 * 24));
  }

  return {
    sessions: sessionCount,
    tokensBefore,
    tokensAfter,
    compressionRatio,
    savingsPercent,
    ageDays,
  };
}

/**
 * Update statistics dashboard (P0-10)
 */
function updateStatisticsDashboard(stats) {
  // Remove skeleton class
  document.querySelectorAll('.skeleton-stats').forEach(el => {
    el.classList.remove('skeleton-stats');
  });

  // Update values with formatted numbers
  document.getElementById('stat-sessions').textContent = stats.sessions;
  document.getElementById('stat-compression').textContent = `${stats.compressionRatio}x`;
  document.getElementById('stat-tokens-before').textContent = formatNumber(stats.tokensBefore);
  document.getElementById('stat-tokens-after').textContent = formatNumber(stats.tokensAfter);
  document.getElementById('stat-savings').textContent = `${stats.savingsPercent}%`;
  document.getElementById('stat-age').textContent = stats.ageDays > 0 ? `${stats.ageDays}d` : '-';
}

/**
 * Token Counter Animation (P0-5)
 */
function animateTokenCounter(start, end, duration) {
  const element = document.getElementById('stat-tokens-after');
  if (!element) return;

  const startTime = performance.now();
  const startColor = { r: 248, g: 113, b: 113 }; // Red-400
  const endColor = { r: 74, g: 222, b: 128 }; // Green-400

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);

    // Easing function for smooth animation
    const easedProgress = easeOutQuad(progress);

    // Calculate current value
    const current = Math.round(start - (start - end) * easedProgress);
    element.textContent = formatNumber(current);

    // Update color (red → green)
    const r = Math.round(startColor.r + (endColor.r - startColor.r) * easedProgress);
    const g = Math.round(startColor.g + (endColor.g - startColor.g) * easedProgress);
    const b = Math.round(startColor.b + (endColor.b - startColor.b) * easedProgress);
    element.style.color = `rgb(${r}, ${g}, ${b})`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/**
 * Layer Loading Animation (P0-6)
 */
function animateLayerLoading(data) {
  const layers = data.layers_loaded;
  const delay = CONFIG.LAYER_DELAY;

  layers.forEach((layerName, index) => {
    setTimeout(() => {
      showLayer(layerName, data[layerName]);
      announceLayerLoading(layerName, index, layers.length);
    }, index * delay);
  });
}

/**
 * Show and populate a single layer
 */
function showLayer(layerName, layerData) {
  const layerElement = document.getElementById(`layer-${layerName}`);
  if (!layerElement) return;

  // Show layer card with animation
  layerElement.classList.remove('hidden');
  layerElement.classList.add('loading');

  // Update status
  const statusElement = document.getElementById(`${layerName}-status`);
  if (statusElement) {
    statusElement.textContent = '✓ Loaded';
    statusElement.className = 'ml-2 text-sm text-green-400';
  }

  // Show checkmark
  const checkElement = document.getElementById(`${layerName}-check`);
  if (checkElement) {
    checkElement.classList.remove('hidden');
  }

  // Populate content (P0-8)
  populateLayerContent(layerName, layerData);

  // Remove animation class after it completes
  setTimeout(() => {
    layerElement.classList.remove('loading');
  }, 500);
}

/**
 * Populate layer content (P0-8)
 */
function populateLayerContent(layerName, data) {
  const contentElement = document.getElementById(`${layerName}-content`);
  if (!contentElement) return;

  let html = '';

  switch (layerName) {
    case 'metadata':
      html = formatMetadataContent(data);
      break;
    case 'reflection':
      html = formatReflectionContent(data);
      break;
    case 'recent':
      html = formatRecentContent(data);
      break;
    case 'progressive':
      html = formatProgressiveContent(data);
      break;
  }

  contentElement.innerHTML = html;
}

/**
 * Format metadata layer content
 */
function formatMetadataContent(data) {
  if (!data) return '<p class="text-gray-400">No metadata available</p>';

  const firstDate = data.first_session ? new Date(data.first_session).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '-';
  const lastDate = data.last_session ? new Date(data.last_session).toLocaleDateString('en-US', {
    year: 'numeric', month: 'short', day: 'numeric'
  }) : '-';

  return `
    <div class="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span class="text-gray-400">Session Count:</span>
        <span class="ml-2 text-white">${data.session_count || '0'}</span>
      </div>
      <div>
        <span class="text-gray-400">High Significance:</span>
        <span class="ml-2 text-white">${data.high_significance_count || '0'}</span>
      </div>
      <div>
        <span class="text-gray-400">First Session:</span>
        <span class="ml-2 text-white">${firstDate}</span>
      </div>
      <div>
        <span class="text-gray-400">Last Session:</span>
        <span class="ml-2 text-white">${lastDate}</span>
      </div>
    </div>
    ${data.key_people && data.key_people.length > 0 ? `
      <div class="mt-4">
        <span class="text-gray-400 text-sm">Key People:</span>
        <div class="flex flex-wrap gap-2 mt-2">
          ${data.key_people.map(person => `
            <span class="bg-blue-900/50 text-blue-300 px-2 py-1 rounded text-xs">${person}</span>
          `).join('')}
        </div>
      </div>
    ` : ''}
    ${data.all_tags && data.all_tags.length > 0 ? `
      <div class="mt-4">
        <span class="text-gray-400 text-sm">Tags:</span>
        <div class="flex flex-wrap gap-2 mt-2">
          ${data.all_tags.slice(0, 10).map(tag => `
            <span class="bg-gray-700 text-gray-300 px-2 py-1 rounded text-xs">${tag}</span>
          `).join('')}
          ${data.all_tags.length > 10 ? `<span class="text-gray-500 text-xs">+${data.all_tags.length - 10} more</span>` : ''}
        </div>
      </div>
    ` : ''}
  `;
}

/**
 * Format reflection layer content
 */
function formatReflectionContent(data) {
  if (!data || data.message) {
    return `<p class="text-gray-400">${data?.message || 'No reflections yet'}</p>`;
  }

  return `
    ${data.experienced ? `
      <div class="mb-4">
        <h4 class="text-sm font-semibold text-purple-400 mb-1">Experienced</h4>
        <p class="text-sm text-gray-300">${truncateText(data.experienced, 200)}</p>
      </div>
    ` : ''}
    ${data.noticed ? `
      <div class="mb-4">
        <h4 class="text-sm font-semibold text-purple-400 mb-1">Noticed</h4>
        <p class="text-sm text-gray-300">${truncateText(data.noticed, 200)}</p>
      </div>
    ` : ''}
    ${data.learned ? `
      <div class="mb-4">
        <h4 class="text-sm font-semibold text-purple-400 mb-1">Learned</h4>
        <p class="text-sm text-gray-300">${truncateText(data.learned, 200)}</p>
      </div>
    ` : ''}
    ${data.becoming ? `
      <div class="mb-4">
        <h4 class="text-sm font-semibold text-purple-400 mb-1">Becoming</h4>
        <p class="text-sm text-gray-300 italic">"${truncateText(data.becoming, 200)}"</p>
      </div>
    ` : ''}
  `;
}

/**
 * Format recent layer content
 */
function formatRecentContent(data) {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return '<p class="text-gray-400">No recent handoffs</p>';
  }

  return data.map((handoff, index) => `
    <div class="border-l-2 border-pink-500/50 pl-4 py-2 mb-3 last:mb-0">
      <div class="flex items-center justify-between mb-2">
        <span class="text-xs text-gray-500">${formatDate(handoff.created_at)}</span>
        ${handoff.significance >= 0.8 ? '<span class="text-xs text-amber-400">⭐ High Significance</span>' : ''}
      </div>
      <p class="text-sm text-gray-300 mb-2">${truncateText(handoff.experienced, 150)}</p>
      ${handoff.becoming ? `
        <p class="text-sm text-pink-400 italic">"${truncateText(handoff.becoming, 100)}"</p>
      ` : ''}
      ${handoff.tags && handoff.tags.length > 0 ? `
        <div class="flex flex-wrap gap-1 mt-2">
          ${handoff.tags.slice(0, 3).map(tag => `
            <span class="bg-gray-700 text-gray-400 px-2 py-0.5 rounded text-xs">${tag}</span>
          `).join('')}
        </div>
      ` : ''}
    </div>
  `).join('');
}

/**
 * Format progressive layer content
 */
function formatProgressiveContent(data) {
  if (!data) {
    return '<p class="text-gray-400">No progressive data</p>';
  }

  if (data.type === 'available_topics' && data.topics) {
    return `
      <p class="text-sm text-gray-400 mb-3">${data.hint || 'Available topics for progressive retrieval:'}</p>
      <div class="flex flex-wrap gap-2">
        ${data.topics.map(topic => `
          <span class="bg-amber-900/50 text-amber-300 px-3 py-1 rounded-full text-sm hover:bg-amber-900/70 cursor-pointer transition">
            ${topic.topic} (${topic.count})
          </span>
        `).join('')}
      </div>
    `;
  }

  if (data.type === 'topic_memories' && data.memories) {
    return `
      <p class="text-sm text-gray-400 mb-3">Topic: <strong class="text-amber-400">${data.topic}</strong></p>
      ${data.memories.map(memory => `
        <div class="border-l-2 border-amber-500/50 pl-4 py-2 mb-2">
          <p class="text-sm text-gray-300">${truncateText(memory.experienced, 150)}</p>
          ${memory.becoming ? `
            <p class="text-sm text-amber-400 italic mt-1">"${truncateText(memory.becoming, 100)}"</p>
          ` : ''}
        </div>
      `).join('')}
    `;
  }

  return '<p class="text-gray-400">No progressive data available</p>';
}

/**
 * Toggle layer expansion (P0-7)
 */
function toggleLayer(layerId) {
  const content = document.getElementById(`${layerId}-content`);
  const button = content.previousElementSibling;
  const expandIcon = document.getElementById(`${layerId}-expand-icon`);

  if (!content || !button) return;

  const isExpanded = content.classList.contains('expanded');

  // Close previously expanded layer (accordion behavior)
  if (state.expandedLayer && state.expandedLayer !== layerId) {
    const prevContent = document.getElementById(`${state.expandedLayer}-content`);
    const prevButton = prevContent?.previousElementSibling;
    const prevIcon = document.getElementById(`${state.expandedLayer}-expand-icon`);

    if (prevContent) {
      prevContent.classList.remove('expanded');
      prevContent.style.maxHeight = '0';
    }
    if (prevButton) {
      prevButton.setAttribute('aria-expanded', 'false');
    }
    if (prevIcon) {
      prevIcon.textContent = '▼';
      prevIcon.style.transform = 'rotate(0deg)';
    }
  }

  // Toggle current layer
  if (isExpanded) {
    // Collapse
    content.classList.remove('expanded');
    content.style.maxHeight = '0';
    button.setAttribute('aria-expanded', 'false');
    expandIcon.textContent = '▼';
    expandIcon.style.transform = 'rotate(0deg)';
    state.expandedLayer = null;
  } else {
    // Expand
    content.classList.add('expanded');
    content.style.maxHeight = content.scrollHeight + 'px';
    button.setAttribute('aria-expanded', 'true');
    expandIcon.textContent = '▲';
    expandIcon.style.transform = 'rotate(180deg)';
    state.expandedLayer = layerId;
  }
}

/**
 * Replay animation (P1-5)
 */
function replayAnimation() {
  if (!state.memoryData) return;

  // Reset all layers
  document.querySelectorAll('.layer-card').forEach(layer => {
    layer.classList.add('hidden');
    layer.classList.remove('loading');
  });

  // Reset status indicators
  document.querySelectorAll('[id$="-status"]').forEach(status => {
    status.textContent = 'Loading...';
    status.className = 'ml-2 text-sm text-gray-500';
  });

  // Hide checkmarks
  document.querySelectorAll('[id$="-check"]').forEach(check => {
    check.classList.add('hidden');
  });

  // Hide replay button
  const replayButton = document.getElementById('replay-button');
  if (replayButton) {
    replayButton.classList.add('hidden');
  }

  // Restart animation
  onDataLoaded(state.memoryData);
}

/**
 * Announce layer loading to screen readers (P1-3)
 */
function announceLayerLoading(layerName, index, total) {
  if (!elements.liveRegion) return;

  const layerNames = {
    metadata: 'Metadata',
    reflection: 'Reflection',
    recent: 'Recent',
    progressive: 'Progressive'
  };

  const message = index < total - 1
    ? `${layerNames[layerName]} layer loaded. ${layerNames[Object.keys(layerNames)[index + 1]]} layer loading...`
    : `${layerNames[layerName]} layer loaded. All layers loaded.`;

  elements.liveRegion.textContent = message;
}

// Error Handler (P0-9)
function showError(error) {
  const errorContainer = document.getElementById('error-container');
  if (!errorContainer) return;

  let errorMessage = 'An error occurred';
  let errorDetails = '';

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

/**
 * Retry button handler
 */
function retryLoad() {
  const errorContainer = document.getElementById('error-container');
  if (errorContainer) {
    errorContainer.classList.add('hidden');
  }
  loadMemoryForTenant(state.currentTenant);
}

/**
 * Loading State (P0-9)
 */
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

// Utility Functions

/**
 * Format number with commas
 */
function formatNumber(num) {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

/**
 * Truncate text with ellipsis
 */
function truncateText(text, maxLength) {
  if (!text) return '';
  return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
}

/**
 * Format date
 */
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Easing function for smooth animations
 */
function easeOutQuad(t) {
  return t * (2 - t);
}

console.log('App.js loaded. Ready.');
