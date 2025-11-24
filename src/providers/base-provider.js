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
}
