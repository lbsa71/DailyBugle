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
   * @param {string} config.model - Model name to use for text generation
   * @param {string} config.imageModel - Optional model name for image generation (defaults to config.model)
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
          temperature: this.config.temperature || DEFAULT_TEMPERATURE,
          stream: true
        }),
        signal: signal
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unable to read error response');
        throw new Error(`LocalAI API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Read SSE stream and accumulate content
      console.log(`[stream] Connected to ${url}, reading stream...`);
      const startTime = Date.now();
      let content = '';
      let chunkCount = 0;
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data: ')) continue;
          const data = trimmed.slice(6);
          if (data === '[DONE]') continue;

          try {
            const parsed = JSON.parse(data);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              chunkCount++;
              content += delta;
              if (chunkCount === 1) {
                console.log(`[stream] First token after ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
              }
            }
          } catch {
            // skip malformed chunks
          }
        }
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`[stream] Done: ${chunkCount} chunks, ${content.length} chars in ${elapsed}s`);

      if (!content) {
        throw new Error('No content received from LocalAI API stream');
      }

      return content;
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
    
    // Use imageModel if specified, otherwise fall back to model
    const imageModel = this.config.imageModel || this.config.model;
    
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
          model: imageModel,
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
      
      const base64Data = data.data[0].b64_json;
      
      // Validate base64 data
      if (typeof base64Data !== 'string' || base64Data.length === 0) {
        throw new Error('Invalid base64 image data from LocalAI API');
      }
      
      // Convert base64 to buffer
      try {
        return Buffer.from(base64Data, 'base64');
      } catch (bufferError) {
        throw new Error(`Failed to decode base64 image data: ${bufferError.message}`);
      }
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
