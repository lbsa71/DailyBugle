import { test } from 'node:test';
import assert from 'node:assert';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  serveStaticFile,
  createRequestHandler,
  callOllama,
  generateSection,
  generateAllSections,
  startTimer
} from './index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to create mock response object
function createMockResponse() {
  const calls = {
    writeHead: [],
    end: []
  };
  
  return {
    writeHead: (...args) => {
      calls.writeHead.push(args);
    },
    end: (...args) => {
      calls.end.push(args);
    },
    calls
  };
}

// Helper to create mock request object
function createMockRequest(url) {
  return { url };
}

test('serveStaticFile - serves HTML file successfully', async () => {
  const mockRes = createMockResponse();
  const testData = Buffer.from('<html>Test</html>');
  
  // Temporarily replace fs.readFile
  const originalReadFile = fs.readFile;
  fs.readFile = async () => testData;
  
  await serveStaticFile('/test/path/index.html', mockRes);
  
  assert.strictEqual(mockRes.calls.writeHead.length, 1);
  assert.strictEqual(mockRes.calls.writeHead[0][0], 200);
  assert.deepStrictEqual(mockRes.calls.writeHead[0][1], { 'Content-Type': 'text/html' });
  assert.strictEqual(mockRes.calls.end.length, 1);
  assert.strictEqual(mockRes.calls.end[0][0], testData);
  
  // Restore original
  fs.readFile = originalReadFile;
});

test('serveStaticFile - handles file not found', async () => {
  const mockRes = createMockResponse();
  
  const originalReadFile = fs.readFile;
  fs.readFile = async () => {
    throw new Error('File not found');
  };
  
  await serveStaticFile('/nonexistent/file.html', mockRes);
  
  assert.strictEqual(mockRes.calls.writeHead.length, 1);
  assert.strictEqual(mockRes.calls.writeHead[0][0], 404);
  assert.strictEqual(mockRes.calls.end.length, 1);
  assert.strictEqual(mockRes.calls.end[0][0], 'Not found');
  
  fs.readFile = originalReadFile;
});

test('serveStaticFile - sets correct MIME types', async () => {
  const testCases = [
    { ext: '.html', expected: 'text/html' },
    { ext: '.js', expected: 'text/javascript' },
    { ext: '.css', expected: 'text/css' },
    { ext: '.json', expected: 'application/json' },
    { ext: '.png', expected: 'image/png' },
    { ext: '.jpg', expected: 'image/jpg' },
    { ext: '.gif', expected: 'image/gif' },
    { ext: '.svg', expected: 'image/svg+xml' },
    { ext: '.ico', expected: 'image/x-icon' },
    { ext: '.unknown', expected: 'application/octet-stream' }
  ];
  
  const originalReadFile = fs.readFile;
  
  for (const testCase of testCases) {
    const mockRes = createMockResponse();
    fs.readFile = async () => Buffer.from('test');
    
    await serveStaticFile(`/test/file${testCase.ext}`, mockRes);
    
    assert.strictEqual(mockRes.calls.writeHead[0][1]['Content-Type'], testCase.expected, 
      `Failed for extension ${testCase.ext}`);
  }
  
  fs.readFile = originalReadFile;
});

test('createRequestHandler - redirects root to index.html', async () => {
  const mockReq = createMockRequest('/');
  const mockRes = createMockResponse();
  
  const testDir = path.join(__dirname, '..');
  const handler = createRequestHandler(testDir);
  
  // Mock fs.readFile to succeed
  const originalReadFile = fs.readFile;
  fs.readFile = async () => Buffer.from('<html></html>');
  
  await handler(mockReq, mockRes);
  
  // Should have called writeHead with 200 (file found)
  assert.strictEqual(mockRes.calls.writeHead.length, 1);
  assert.strictEqual(mockRes.calls.writeHead[0][0], 200);
  
  fs.readFile = originalReadFile;
});

test('createRequestHandler - blocks path traversal attacks', async () => {
  const mockReq = createMockRequest('/../../etc/passwd');
  const mockRes = createMockResponse();
  
  const testDir = path.join(__dirname, '..');
  const handler = createRequestHandler(testDir);
  
  await handler(mockReq, mockRes);
  
  assert.strictEqual(mockRes.calls.writeHead.length, 1);
  assert.strictEqual(mockRes.calls.writeHead[0][0], 403);
  assert.strictEqual(mockRes.calls.end[0][0], 'Forbidden');
});

test('createRequestHandler - blocks path traversal with encoded characters', async () => {
  const mockReq = createMockRequest('/..%2F..%2Fetc%2Fpasswd');
  const mockRes = createMockResponse();
  
  const testDir = path.join(__dirname, '..');
  const handler = createRequestHandler(testDir);
  
  await handler(mockReq, mockRes);
  
  // Path traversal should be blocked (403) or file not found (404)
  // Both are acceptable security behaviors
  assert.strictEqual(mockRes.calls.writeHead.length, 1);
  const statusCode = mockRes.calls.writeHead[0][0];
  assert.ok(statusCode === 403 || statusCode === 404, 
    `Expected 403 or 404, got ${statusCode}`);
});

test('callOllama - makes correct API request', async () => {
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
  
  const ollamaConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  };
  
  const result = await callOllama('System prompt', 'User prompt', ollamaConfig);
  
  assert.ok(fetchCall);
  assert.strictEqual(fetchCall.url, 'http://localhost:11434/api/generate');
  assert.strictEqual(fetchCall.options.method, 'POST');
  assert.strictEqual(fetchCall.options.headers['Content-Type'], 'application/json');
  
  const body = JSON.parse(fetchCall.options.body);
  assert.strictEqual(body.model, 'test-model');
  assert.strictEqual(body.prompt, 'User prompt');
  assert.strictEqual(body.system, 'System prompt');
  assert.strictEqual(body.stream, false);
  assert.strictEqual(body.options.temperature, 0.8);
  
  assert.strictEqual(result, 'Generated content');
  
  globalThis.fetch = originalFetch;
});

test('callOllama - handles API errors', async () => {
  const mockResponse = {
    ok: false,
    status: 500,
    statusText: 'Internal Server Error'
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => mockResponse;
  
  const ollamaConfig = {
    baseUrl: 'http://localhost:11434',
    model: 'test-model',
    temperature: 0.8
  };
  
  await assert.rejects(
    () => callOllama('System prompt', 'User prompt', ollamaConfig),
    {
      message: 'Ollama API error: 500 Internal Server Error'
    }
  );
  
  globalThis.fetch = originalFetch;
});

test('generateSection - generates section with global system prompt', async () => {
  let fetchCall = null;
  const mockResponse = {
    ok: true,
    json: async () => ({ response: 'Article content here' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const section = {
    id: 'test-section',
    name: 'Test Section',
    reporter: 'Test Reporter',
    systemPrompt: 'Section-specific prompt',
    sectionPrompt: 'Write an article'
  };
  
  const configData = {
    systemPrompt: 'Global system prompt',
    ollamaConfig: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  };
  
  const result = await generateSection(section, configData);
  
  assert.strictEqual(result.id, 'test-section');
  assert.strictEqual(result.name, 'Test Section');
  assert.strictEqual(result.reporter, 'Test Reporter');
  assert.strictEqual(result.content, 'Article content here');
  assert.ok(result.timestamp);
  assert.ok(new Date(result.timestamp).toISOString());
  
  // Verify system prompts were concatenated
  const fetchBody = JSON.parse(fetchCall.options.body);
  assert.strictEqual(fetchBody.system, 'Global system prompt Section-specific prompt');
  
  globalThis.fetch = originalFetch;
});

test('generateSection - generates section without global system prompt', async () => {
  let fetchCall = null;
  const mockResponse = {
    ok: true,
    json: async () => ({ response: 'Article content' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCall = { url, options };
    return mockResponse;
  };
  
  const section = {
    id: 'test-section',
    name: 'Test Section',
    reporter: 'Test Reporter',
    systemPrompt: 'Section-specific prompt',
    sectionPrompt: 'Write an article'
  };
  
  const configData = {
    ollamaConfig: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  };
  
  const result = await generateSection(section, configData);
  
  assert.strictEqual(result.content, 'Article content');
  
  // Verify only section prompt was used
  const fetchBody = JSON.parse(fetchCall.options.body);
  assert.strictEqual(fetchBody.system, 'Section-specific prompt');
  
  globalThis.fetch = originalFetch;
});

test('generateAllSections - generates all sections and saves files', async () => {
  let fetchCalls = [];
  const mockResponse = {
    ok: true,
    json: async () => ({ response: 'Generated article content' })
  };
  
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    fetchCalls.push({ url, options });
    return mockResponse;
  };
  
  const originalReadFile = fs.readFile;
  const originalWriteFile = fs.writeFile;
  const originalMkdir = fs.mkdir;
  
  const writeFileCalls = [];
  const mkdirCalls = [];
  
  fs.mkdir = async (dir) => {
    mkdirCalls.push(dir);
  };
  
  fs.writeFile = async (filepath, content) => {
    writeFileCalls.push({ filepath, content });
  };
  
  const configData = {
    systemPrompt: 'Global prompt',
    sections: [
      {
        id: 'section1',
        name: 'Section 1',
        reporter: 'Reporter 1',
        systemPrompt: 'Prompt 1',
        sectionPrompt: 'Write article 1'
      },
      {
        id: 'section2',
        name: 'Section 2',
        reporter: 'Reporter 2',
        systemPrompt: 'Prompt 2',
        sectionPrompt: 'Write article 2'
      }
    ],
    ollamaConfig: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  };
  
  const testDir = path.join(__dirname, '..');
  await generateAllSections(configData, testDir);
  
  // Verify all sections were generated (2 sections)
  assert.strictEqual(fetchCalls.length, 2);
  
  // Verify files were written (2 section files + 1 news.json)
  assert.strictEqual(writeFileCalls.length, 3);
  
  // Verify news.json was written with correct structure
  const newsJsonCall = writeFileCalls.find(call => 
    call.filepath.includes('news.json')
  );
  assert.ok(newsJsonCall, 'news.json should be written');
  
  const newsJsonContent = JSON.parse(newsJsonCall.content);
  assert.strictEqual(newsJsonContent.items.length, 2);
  assert.ok(newsJsonContent.generated);
  assert.strictEqual(newsJsonContent.items[0].id, 'section1');
  assert.strictEqual(newsJsonContent.items[1].id, 'section2');
  
  // Verify HTML files were created
  const htmlCalls = writeFileCalls.filter(call => 
    call.filepath.endsWith('.html')
  );
  assert.strictEqual(htmlCalls.length, 2);
  
  // Verify HTML content structure
  const htmlContent = htmlCalls[0].content;
  assert.ok(htmlContent.includes('<!DOCTYPE html>'));
  assert.ok(htmlContent.includes('Section 1'));
  assert.ok(htmlContent.includes('Reporter 1'));
  assert.ok(htmlContent.includes('Generated article content'));
  
  fs.readFile = originalReadFile;
  fs.writeFile = originalWriteFile;
  fs.mkdir = originalMkdir;
  globalThis.fetch = originalFetch;
});

test('startTimer - schedules at 1 AM', () => {
  const configData = {
    sections: [],
    ollamaConfig: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  };
  
  const testDir = path.join(__dirname, '..');
  
  // Mock console.log to avoid output during tests
  const originalLog = console.log;
  console.log = () => {};
  
  // Mock setTimeout to capture the schedule
  const timeouts = [];
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    timeouts.push({ fn, ms });
    return 123; // mock timeout ID
  };
  
  // Mock Date to control current time
  const now = new Date('2024-01-15T14:30:00Z'); // 2:30 PM
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now.getTime());
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  startTimer(configData, testDir);
  
  // Verify setTimeout was called (for scheduling)
  assert.ok(timeouts.length > 0);
  
  // Calculate expected time until next 1 AM
  // Since we're at 2:30 PM, next 1 AM is tomorrow
  // Should be between 9.5 and 11 hours (allowing for timezone differences)
  const expectedMs = timeouts[0].ms;
  const hours = expectedMs / 1000 / 60 / 60;
  // Should be approximately 9.5-11 hours, allowing for timezone differences
  assert.ok(expectedMs > 32400000 && expectedMs < 43200000, 
    `Expected timeout between 9-12 hours, got ${expectedMs}ms (${hours.toFixed(2)} hours)`);
  
  console.log = originalLog;
  global.setTimeout = originalSetTimeout;
  global.Date = originalDate;
});

test('startTimer - schedules next day at 1 AM', () => {
  const configData = {
    sections: [],
    ollamaConfig: {
      baseUrl: 'http://localhost:11434',
      model: 'test-model',
      temperature: 0.8
    }
  };
  
  const testDir = path.join(__dirname, '..');
  
  // Mock console methods
  const originalLog = console.log;
  console.log = () => {};
  
  // Mock setTimeout
  const timeouts = [];
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms) => {
    timeouts.push({ fn, ms });
    return 123;
  };
  
  // Mock Date - set to 2:30 PM
  const now = new Date('2024-01-15T14:30:00Z');
  const originalDate = global.Date;
  global.Date = class extends originalDate {
    constructor(...args) {
      if (args.length === 0) {
        super(now.getTime());
      } else {
        super(...args);
      }
    }
    static now() {
      return now.getTime();
    }
  };
  
  startTimer(configData, testDir);
  
  // Verify setTimeout was called to schedule next 1 AM
  assert.strictEqual(timeouts.length, 1);
  // Next 1 AM should be approximately 9.5-11 hours away (allowing for timezone differences)
  const hours = timeouts[0].ms / 1000 / 60 / 60;
  assert.ok(timeouts[0].ms > 32400000 && timeouts[0].ms < 43200000,
    `Expected timeout between 9-12 hours, got ${timeouts[0].ms}ms (${hours.toFixed(2)} hours)`);
  
  console.log = originalLog;
  global.setTimeout = originalSetTimeout;
  global.Date = originalDate;
});
