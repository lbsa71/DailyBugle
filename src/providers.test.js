import { test } from 'node:test';
import assert from 'node:assert';
import { 
  BaseProvider, 
  OllamaProvider, 
  LocalAIProvider, 
  ProviderFactory 
} from './providers/index.js';

// Test BaseProvider
test('BaseProvider - cannot be instantiated directly', () => {
  assert.throws(
    () => new BaseProvider({}),
    {
      message: 'BaseProvider is abstract and cannot be instantiated directly'
    }
  );
});

// Test OllamaProvider
test('OllamaProvider - requires baseUrl', () => {
  assert.throws(
    () => new OllamaProvider({ model: 'test' }),
    {
      message: 'Ollama provider requires baseUrl in configuration'
    }
  );
});

test('OllamaProvider - requires model', () => {
  assert.throws(
    () => new OllamaProvider({ baseUrl: 'http://localhost:11434' }),
    {
      message: 'Ollama provider requires model in configuration'
    }
  );
});

test('OllamaProvider - creates instance with valid config', () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  });
  
  assert.strictEqual(provider.getName(), 'ollama');
  assert.strictEqual(provider.config.baseUrl, 'http://localhost:11434');
  assert.strictEqual(provider.config.model, 'test-model');
  assert.strictEqual(provider.canGenerateImages, false);
});

test('OllamaProvider - generates content successfully', async () => {
  let fetchCall = null;
  const mockResponse = {
    ok: true,
    json: async () => ({ response: 'Generated content' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  });
  
  const result = await provider.generate('System prompt', 'User prompt');
  
  assert.strictEqual(result, 'Generated content');
  assert.strictEqual(fetchCall.url, 'http://localhost:11434/api/generate');
  assert.strictEqual(fetchCall.options.method, 'POST');
  
  const body = JSON.parse(fetchCall.options.body);
  assert.strictEqual(body.model, 'test-model');
  assert.strictEqual(body.system, 'System prompt');
  assert.strictEqual(body.prompt, 'User prompt');
  assert.strictEqual(body.stream, false);
  assert.strictEqual(body.options.temperature, 0.8);
  
  globalThis.fetch = originalFetch;
});

test('OllamaProvider - handles API errors', async () => {
  const mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'Error details'
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generate('System prompt', 'User prompt'),
    {
      message: 'Ollama API error: 500 Internal Server Error - Error details'
    }
  );
  
  globalThis.fetch = originalFetch;
});

test('OllamaProvider - throws error on image generation', async () => {
  const provider = new OllamaProvider({
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generateImage('Test prompt'),
    {
      message: 'Image generation is not supported by Ollama provider'
    }
  );
});

// Test LocalAIProvider
test('LocalAIProvider - requires baseUrl', () => {
  assert.throws(
    () => new LocalAIProvider({ model: 'test' }),
    {
      message: 'LocalAI provider requires baseUrl in configuration'
    }
  );
});

test('LocalAIProvider - requires model', () => {
  assert.throws(
    () => new LocalAIProvider({ baseUrl: 'http://localhost:8080' }),
    {
      message: 'LocalAI provider requires model in configuration'
    }
  );
});

test('LocalAIProvider - creates instance with valid config', () => {
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'gpt-3.5-turbo',
    temperature: 0.8
  });
  
  assert.strictEqual(provider.getName(), 'localai');
  assert.strictEqual(provider.config.baseUrl, 'http://localhost:8080');
  assert.strictEqual(provider.config.model, 'gpt-3.5-turbo');
  assert.strictEqual(provider.canGenerateImages, true);
});

test('LocalAIProvider - generates content successfully', async () => {
  let fetchCall = null;
  const mockResponse = {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: 'Generated content from LocalAI'
          }
        }
      ]
    })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'gpt-3.5-turbo',
    temperature: 0.8
  });
  
  const result = await provider.generate('System prompt', 'User prompt');
  
  assert.strictEqual(result, 'Generated content from LocalAI');
  assert.strictEqual(fetchCall.url, 'http://localhost:8080/v1/chat/completions');
  assert.strictEqual(fetchCall.options.method, 'POST');
  
  const body = JSON.parse(fetchCall.options.body);
  assert.strictEqual(body.model, 'gpt-3.5-turbo');
  assert.strictEqual(body.temperature, 0.8);
  assert.strictEqual(body.messages.length, 2);
  assert.strictEqual(body.messages[0].role, 'system');
  assert.strictEqual(body.messages[0].content, 'System prompt');
  assert.strictEqual(body.messages[1].role, 'user');
  assert.strictEqual(body.messages[1].content, 'User prompt');
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - includes API key when provided', async () => {
  let fetchCall = null;
  const mockResponse = {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: 'Generated content' } }]
    })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'gpt-3.5-turbo',
    temperature: 0.8,
    apiKey: 'test-api-key'
  });
  
  await provider.generate('System prompt', 'User prompt');
  
  assert.strictEqual(fetchCall.options.headers['Authorization'], 'Bearer test-api-key');
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - handles API errors', async () => {
  const mockResponse = {
    ok: false,
    status: 401,
    statusText: 'Unauthorized',
    text: async () => 'Authentication failed'
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'gpt-3.5-turbo',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generate('System prompt', 'User prompt'),
    {
      message: 'LocalAI API error: 401 Unauthorized - Authentication failed'
    }
  );
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - handles invalid response format', async () => {
  const mockResponse = {
    ok: true,
    json: async () => ({ invalid: 'response' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'gpt-3.5-turbo',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generate('System prompt', 'User prompt'),
    {
      message: 'Invalid response format from LocalAI API'
    }
  );
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - generates image successfully', async () => {
  let fetchCall = null;
  const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const mockResponse = {
    ok: true,
    json: async () => ({
      data: [
        {
          b64_json: mockImageData
        }
      ]
    })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'dall-e-3',
    temperature: 0.8
  });
  
  const result = await provider.generateImage('Test image prompt');
  
  assert.ok(result instanceof Buffer);
  assert.strictEqual(fetchCall.url, 'http://localhost:8080/v1/images/generations');
  assert.strictEqual(fetchCall.options.method, 'POST');
  
  const body = JSON.parse(fetchCall.options.body);
  assert.strictEqual(body.prompt, 'Test image prompt');
  assert.strictEqual(body.n, 1);
  assert.strictEqual(body.size, '256x256');
  assert.strictEqual(body.response_format, 'b64_json');
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - handles image generation errors', async () => {
  const mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error',
    text: async () => 'Image generation failed'
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'dall-e-3',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generateImage('Test prompt'),
    {
      message: 'LocalAI image generation error: 500 Internal Server Error - Image generation failed'
    }
  );
  
  globalThis.fetch = originalFetch;
});

test('LocalAIProvider - handles invalid image response format', async () => {
  const mockResponse = {
    ok: true,
    json: async () => ({ invalid: 'response' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const provider = new LocalAIProvider({
    baseUrl: 'http://localhost:8080',
    model: 'dall-e-3',
    temperature: 0.8
  });
  
  await assert.rejects(
    () => provider.generateImage('Test prompt'),
    {
      message: 'Invalid image response format from LocalAI API'
    }
  );
  
  globalThis.fetch = originalFetch;
});

// Test ProviderFactory
test('ProviderFactory - creates OllamaProvider', () => {
  const provider = ProviderFactory.createProvider({
    type: 'ollama',
    config: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  });
  
  assert.ok(provider instanceof OllamaProvider);
  assert.strictEqual(provider.getName(), 'ollama');
});

test('ProviderFactory - creates LocalAIProvider', () => {
  const provider = ProviderFactory.createProvider({
    type: 'localai',
    config: {
      baseUrl: 'http://localhost:8080',
      model: 'gpt-3.5-turbo',
      temperature: 0.8
    }
  });
  
  assert.ok(provider instanceof LocalAIProvider);
  assert.strictEqual(provider.getName(), 'localai');
});

test('ProviderFactory - handles case insensitive type', () => {
  const provider1 = ProviderFactory.createProvider({
    type: 'OLLAMA',
    config: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  });
  
  const provider2 = ProviderFactory.createProvider({
    type: 'LocalAI',
    config: {
      baseUrl: 'http://localhost:8080',
      model: 'gpt-3.5-turbo',
      temperature: 0.8
    }
  });
  
  assert.ok(provider1 instanceof OllamaProvider);
  assert.ok(provider2 instanceof LocalAIProvider);
});

test('ProviderFactory - throws error for unknown type', () => {
  assert.throws(
    () => ProviderFactory.createProvider({
      type: 'unknown',
      config: {}
    }),
    {
      message: "Unknown provider type: unknown. Supported types: 'ollama', 'localai'"
    }
  );
});

test('ProviderFactory - throws error for missing type', () => {
  assert.throws(
    () => ProviderFactory.createProvider({
      config: {}
    }),
    {
      message: 'Provider configuration must include a type property'
    }
  );
});

test('ProviderFactory - throws error for null config', () => {
  assert.throws(
    () => ProviderFactory.createProvider(null),
    {
      message: 'Provider configuration is required'
    }
  );
});
