import { BaseProvider } from './base-provider.js';
import { DEFAULT_TEMPERATURE } from './constants.js';

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
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: this.config.model,
          messages: messages,
          temperature: this.config.temperature || DEFAULT_TEMPERATURE
        }),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`LocalAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Extract content from OpenAI-compatible response format
      if (!data.choices || !data.choices[0] || !data.choices[0].message) {
        throw new Error('Invalid response format from LocalAI API');
      }
      
      return data.choices[0].message.content;
    } catch (error) {
      // Enhance fetch errors with more context
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to LocalAI at ${url}: ${error.message}. Check if the service is running and the baseUrl is correct.`);
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
    return 'localai';
  }

  /**
   * Check if provider supports image generation
   * @returns {boolean} True - LocalAI supports image generation
   */
  get canGenerateImages() {
    return true;
  }

  /**
   * Generate an image using LocalAI (OpenAI-compatible API)
   * @param {string} prompt - Prompt for image generation
   * @param {AbortSignal} signal - Optional abort signal for cancellation
   * @returns {Promise<Buffer>} Generated image as a buffer
   */
  async generateImage(prompt, signal = null) {
    const url = `${this.config.baseUrl}/v1/images/generations`;
    
    const headers = {
      'Content-Type': 'application/json',
    };
    
    // Add API key if provided (some LocalAI instances may require it)
    if (this.config.apiKey) {
      headers['Authorization'] = `Bearer ${this.config.apiKey}`;
    }
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          prompt: prompt,
          n: 1,
          size: '256x256', // Small size as requested
          response_format: 'b64_json'
        }),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`LocalAI image generation error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Extract base64 image data from OpenAI-compatible response format
      if (!data.data || !data.data[0] || !data.data[0].b64_json) {
        throw new Error('Invalid image response format from LocalAI API');
      }
      
      // Convert base64 to buffer
      return Buffer.from(data.data[0].b64_json, 'base64');
    } catch (error) {
      // Enhance fetch errors with more context
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(`Failed to connect to LocalAI at ${url}: ${error.message}. Check if the service is running and the baseUrl is correct.`);
      }
      if (error.name === 'AbortError') {
        throw new Error('Request was aborted');
      }
      throw error;
    }
  }
}
