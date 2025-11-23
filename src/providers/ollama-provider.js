import { BaseProvider } from './base-provider.js';
import { DEFAULT_TEMPERATURE } from './constants.js';

/**
 * Ollama provider implementation
 */
export class OllamaProvider extends BaseProvider {
  /**
   * Initialize Ollama provider
   * @param {Object} config - Ollama configuration
   * @param {string} config.baseUrl - Base URL for Ollama API
   * @param {string} config.model - Model name to use
   * @param {number} config.temperature - Temperature for generation
   */
  constructor(config) {
    super(config);
    
    if (!config.baseUrl) {
      throw new Error('Ollama provider requires baseUrl in configuration');
    }
    if (!config.model) {
      throw new Error('Ollama provider requires model in configuration');
    }
  }

  /**
   * Generate content using Ollama API
   * @param {string} systemPrompt - System prompt to set the context
   * @param {string} userPrompt - User prompt for content generation
   * @param {AbortSignal} signal - Optional abort signal for cancellation
   * @returns {Promise<string>} Generated content
   */
  async generate(systemPrompt, userPrompt, signal = null) {
    const url = `${this.config.baseUrl}/api/generate`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.config.model,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: this.config.temperature || DEFAULT_TEMPERATURE
        }
      }),
      signal: signal
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return 'ollama';
  }
}
