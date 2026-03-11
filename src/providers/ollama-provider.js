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
    
    try {
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
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`Ollama API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      return data.response;
    } catch (error) {
      // Enhance fetch errors with more context
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to Ollama at ${url}: ${error.message}. Check if the service is running and the baseUrl is correct.`);
      }
      if (error.name === 'AbortError') {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getName() {
    return 'ollama';
  }

  /**
   * Check if provider supports image generation
   * @returns {boolean} False - Ollama does not support image generation
   */
  get canGenerateImages() {
    return false;
  }

  /**
   * Generate an image (not supported by Ollama)
   * @throws {Error} Always throws - Ollama does not support image generation
   */
  async generateImage(prompt, signal = null) {
    throw new Error('Image generation is not supported by Ollama provider');
  }
}
