import { BaseProvider } from './base-provider.js';

/**
 * LocalAI provider implementation (OpenAI-compatible API)
 */
export class LocalAIProvider extends BaseProvider {
  /**
   * Initialize LocalAI provider
   * @param {Object} config - LocalAI configuration
   * @param {string} config.baseUrl - Base URL for LocalAI API
   * @param {string} config.model - Model name to use
   * @param {number} config.temperature - Temperature for generation
   * @param {string} config.apiKey - Optional API key (for compatibility)
   */
  constructor(config) {
    super(config);
    
    if (!config.baseUrl) {
      throw new Error('LocalAI provider requires baseUrl in configuration');
    }
    if (!config.model) {
      throw new Error('LocalAI provider requires model in configuration');
    }
  }

  /**
   * Generate content using LocalAI (OpenAI-compatible API)
   * @param {string} systemPrompt - System prompt to set the context
   * @param {string} userPrompt - User prompt for content generation
   * @param {AbortSignal} signal - Optional abort signal for cancellation
   * @returns {Promise<string>} Generated content
   */
  async generate(systemPrompt, userPrompt, signal = null) {
    const url = `${this.config.baseUrl}/v1/chat/completions`;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if provided (some LocalAI instances may require it)
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt }
    ];
    
    const response = await fetch(url, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        model: this.config.model,
        messages: messages,
        temperature: this.config.temperature || 0.8
      }),
      signal: signal
    });

    if (!response.ok) {
      throw new Error(`LocalAI API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    // Extract content from OpenAI-compatible response format
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from LocalAI API');
    }
    
    return data.choices[0].message.content;
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return 'localai';
  }
}
