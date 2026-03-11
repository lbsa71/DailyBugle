/**
 * Base class for AI providers
 * Defines the interface that all providers must implement
 */
export class BaseProvider {
  /**
   * Initialize the provider with configuration
   * @param {Object} config - Provider-specific configuration
   */
  constructor(config) {
    if (new.target === BaseProvider) {
      throw new Error('BaseProvider is abstract and cannot be instantiated directly');
    }
    this.config = config;
  }

  /**
   * Generate content using the AI provider
   * @param {string} systemPrompt - System prompt to set the context
   * @param {string} userPrompt - User prompt for content generation
   * @param {AbortSignal} signal - Optional abort signal for cancellation
   * @returns {Promise<string>} Generated content
   */
  async generate(systemPrompt, userPrompt, signal = null) {
    throw new Error('generate() must be implemented by subclass');
  }

  /**
   * Get the provider name
   * @returns {string} Provider name
   */
  getName() {
    throw new Error('getName() must be implemented by subclass');
  }

  /**
   * Check if provider supports image generation
   * @returns {boolean} True if provider can generate images
   */
  get canGenerateImages() {
    throw new Error('canGenerateImages must be implemented by subclass');
  }

  /**
   * Generate an image using the AI provider
   * @param {string} prompt - Prompt for image generation
   * @param {AbortSignal} signal - Optional abort signal for cancellation
   * @returns {Promise<Buffer>} Generated image as a buffer
   */
  async generateImage(prompt, signal = null) {
    throw new Error('generateImage() must be implemented by subclass');
  }
}
