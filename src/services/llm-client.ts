/**
 * Simple LLM Client
 *
 * Supports OpenAI (GPT-4), Anthropic (Claude), and z.ai APIs
 */

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  model: string;
}

export class LLMClient {
  private apiKey: string;
  private provider: 'openai' | 'anthropic' | 'zai';
  private baseURL?: string;

  constructor(apiKey: string, provider: 'openai' | 'anthropic' | 'zai', baseURL?: string) {
    this.apiKey = apiKey;
    this.provider = provider;
    this.baseURL = baseURL;
  }

  /**
   * Send chat completion request
   */
  async chat(messages: LLMMessage[], model?: string): Promise<LLMResponse> {
    if (this.provider === 'zai') {
      return await this.chatZAI(messages, model || 'glm-4.7');
    } else if (this.provider === 'openai') {
      return await this.chatOpenAI(messages, model || 'gpt-4');
    } else {
      return await this.chatAnthropic(messages, model || 'claude-3-sonnet-20240229');
    }
  }

  /**
   * z.ai API (OpenAI-compatible)
   */
  private async chatZAI(messages: LLMMessage[], model: string): Promise<LLMResponse> {
    const response = await fetch(`${this.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('[z.ai] API Error Response:', error);
      throw new Error(`z.ai API error: ${error}`);
    }

    const data = await response.json();
    console.log('[z.ai] Raw Response:', JSON.stringify(data, null, 2).substring(0, 800));

    // Check different possible response formats
    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;

      // If content is empty but there's reasoning_content, use that
      if (!content && data.choices[0].message.reasoning_content) {
        content = data.choices[0].message.reasoning_content;
      }
    } else if (data.content) {
      content = data.content;
    } else if (data.message) {
      content = data.message;
    } else {
      console.warn('[z.ai] Unexpected response format:', data);
      content = JSON.stringify(data);
    }

    if (!content) {
      console.warn('[z.ai] Empty response, using fallback');
      content = '(No response from z.ai API)';
    }

    return {
      content,
      model: data.model || model
    };
  }

  /**
   * OpenAI (GPT-4) chat
   */
  private async chatOpenAI(messages: LLMMessage[], model: string): Promise<LLMResponse> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.choices[0].message.content,
      model: data.model
    };
  }

  /**
   * Anthropic (Claude) chat
   */
  private async chatAnthropic(messages: LLMMessage[], model: string): Promise<LLMResponse> {
    // Convert messages to Anthropic format
    const systemMessage = messages.find(m => m.role === 'system');
    const chatMessages = messages.filter(m => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemMessage?.content || '',
        messages: chatMessages.map(m => ({
          role: m.role,
          content: m.content
        })),
        max_tokens: 500
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Anthropic API error: ${error}`);
    }

    const data = await response.json();
    return {
      content: data.content[0].text,
      model: data.model
    };
  }
}

/**
 * Create LLM client from environment variables
 */
export function createLLMClient(): LLMClient | null {
  const zaiKey = process.env.ZAI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (zaiKey) {
    console.log('[LLM] Using z.ai API');
    return new LLMClient(zaiKey, 'zai', 'https://api.z.ai/api/coding/paas/v4');
  }

  if (openaiKey) {
    console.log('[LLM] Using OpenAI (GPT-4)');
    return new LLMClient(openaiKey, 'openai');
  }

  if (anthropicKey) {
    console.log('[LLM] Using Anthropic (Claude)');
    return new LLMClient(anthropicKey, 'anthropic');
  }

  console.warn('[LLM] No API key found - using mock responses');
  return null;
}
