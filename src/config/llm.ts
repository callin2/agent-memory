/**
 * LLM Configuration
 *
 * Centralized configuration for all LLM providers
 */

export interface LLMConfig {
  provider: 'zai' | 'openai' | 'anthropic';
  apiKey: string;
  baseURL: string;
  model: string;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Get LLM configuration from environment variables
 */
export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER || 'zai') as LLMConfig['provider'];
  const apiKey = process.env.ZAI_API_KEY || process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY || '';

  if (!apiKey) {
    console.warn('[LLM Config] No API key found in environment variables');
  }

  const config: LLMConfig = {
    provider,
    apiKey,
    baseURL: process.env.ZAI_BASE_URL || 'https://open.bigmodel.cn/api/paas/v4',
    model: process.env.LLM_MODEL || 'GLM-4.5-air',
    temperature: parseFloat(process.env.LLM_TEMPERATURE || '0.7'),
    maxTokens: parseInt(process.env.LLM_MAX_TOKENS || '1000', 10)
  };

  // Override based on provider
  if (provider === 'openai') {
    config.baseURL = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';
    config.model = process.env.LLM_MODEL || 'gpt-4';
  } else if (provider === 'anthropic') {
    config.baseURL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com';
    config.model = process.env.LLM_MODEL || 'claude-3-sonnet-20240229';
  }

  console.log(`[LLM Config] Provider: ${provider}, Model: ${config.model}, BaseURL: ${config.baseURL}`);

  return config;
}

/**
 * Get LLM configuration for chat demo
 */
export function getChatDemoLLMConfig(): LLMConfig {
  return getLLMConfig();
}
