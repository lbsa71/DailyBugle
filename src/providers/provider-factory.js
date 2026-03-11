import { OllamaProvider } from './ollama-provider.js';
import { LocalAIProvider } from './localai-provider.js';

/**
 * Factory for creating AI providers
 */
export class ProviderFactory {
  /**
   * Create a provider instance based on configuration
   * @param {Object} providerConfig - Provider configuration
   * @param {string} providerConfig.type - Provider type ('ollama' or 'localai')
   * @param {Object} providerConfig.config - Provider-specific configuration
   * @returns {BaseProvider} Provider instance
   */
  static createProvider(providerConfig) {
    if (!providerConfig) {
      throw new Error('Provider configuration is required');
    }
    
    if (!providerConfig.type) {
      throw new Error('Provider configuration must include a type property');
    }
    
    const type = providerConfig.type.toLowerCase();
    
    switch (type) {
      case 'ollama':
        return new OllamaProvider(providerConfig.config);
      
      case 'localai':
        return new LocalAIProvider(providerConfig.config);
      
      default:
        throw new Error(`Unknown provider type: ${type}. Supported types: 'ollama', 'localai'`);
    }
  }
}
