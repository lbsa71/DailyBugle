import { createServer } from 'http';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { parse as parseUrl } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

// Simple static file server
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

export async function serveStaticFile(filePath, res) {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404);
    res.end('Not found');
  }
}

export function createRequestHandler(baseDir) {
  return async (req, res) => {
    const parsedUrl = parseUrl(req.url, true);
    let pathname = parsedUrl.pathname;
    
    // Default to index.html
    if (pathname === '/') {
      pathname = '/index.html';
    }
    
    // Serve from public directory with path traversal protection
    const publicDir = path.join(baseDir, '../public');
    const requestedPath = path.join(publicDir, pathname);
    const resolvedPath = path.resolve(requestedPath);
    
    // Security: Ensure the resolved path is within the public directory
    if (!resolvedPath.startsWith(path.resolve(publicDir))) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }
    
    await serveStaticFile(resolvedPath, res);
  };
}

const server = createServer(createRequestHandler(__dirname));

// Load configuration
let config;
try {
  const configData = await fs.readFile(path.join(__dirname, '../config/sections.json'), 'utf-8');
  config = JSON.parse(configData);
} catch (error) {
  console.error('Error loading config:', error);
  process.exit(1);
}

/**
 * Display configuration settings at startup
 */
function displayConfig(configData) {
  console.log('\n========================================');
  console.log('Daily Bugle Configuration');
  console.log('========================================\n');
  
  console.log('Ollama Configuration:');
  console.log(`  Base URL: ${configData.ollamaConfig.baseUrl}`);
  console.log(`  Model: ${configData.ollamaConfig.model}`);
  console.log(`  Temperature: ${configData.ollamaConfig.temperature}`);
  
  console.log('\nScheduler Configuration:');
  console.log(`  Schedule: Daily at 1:00 AM`);
  console.log(`  Retry on Failure: Every 10 minutes`);
  
  console.log('\nSystem Prompt:');
  console.log(`  ${configData.systemPrompt || '(none)'}`);
  
  console.log(`\nSections: ${configData.sections.length}`);
  configData.sections.forEach((section, index) => {
    console.log(`  ${index + 1}. ${section.name} (${section.id}) - ${section.reporter}`);
  });
  
  console.log('\n========================================\n');
}

/**
 * Call Ollama API to generate content
 */
export async function callOllama(systemPrompt, userPrompt, ollamaConfig, signal = null) {
  const url = `${ollamaConfig.baseUrl}/api/generate`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: ollamaConfig.model,
      prompt: userPrompt,
      system: systemPrompt,
      stream: false,
      options: {
        temperature: ollamaConfig.temperature
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
 * Generate content for a single section
 */
export async function generateSection(section, configData, signal = null) {
  console.log(`Generating ${section.name} by ${section.reporter}...`);
  // Concatenate global system prompt with section-specific prompt
  const fullSystemPrompt = configData.systemPrompt 
    ? `${configData.systemPrompt} ${section.systemPrompt}`
    : section.systemPrompt;
  const content = await callOllama(fullSystemPrompt, section.sectionPrompt, configData.ollamaConfig, signal);
  return {
    id: section.id,
    name: section.name,
    reporter: section.reporter,
    content: content,
    timestamp: new Date().toISOString()
  };
}

/**
 * Generate all sections in parallel and save results
 */
export async function generateAllSections(configData, baseDir, signal = null) {
  console.log('Starting content generation...');
  const startTime = Date.now();
  
  // Generate all sections in parallel
  const results = await Promise.all(
    configData.sections.map(section => generateSection(section, configData, signal))
  );
  
  // Create timestamp for filenames
  const now = new Date();
  const isoString = now.toISOString();
  const timestamp = isoString.replace(/[:.]/g, '-').split('T')[0];
  const timeHour = isoString.split('T')[1].substring(0, 5).replace(':', '-');
  const dateFolder = `${timestamp}_${timeHour}`;
  
  // Save each section to a file
  const newsItems = [];
  for (const result of results) {
    const sectionDir = path.join(baseDir, '../public/sections', result.id);
    await fs.mkdir(sectionDir, { recursive: true });
    
    const filename = `${dateFolder}.html`;
    const filepath = path.join(sectionDir, filename);
    
    // Create simple HTML content for the article
    // Template is inline for simplicity - this is a single-purpose POC service
    const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${result.name} - Daily Bugle</title>
</head>
<body>
    <article>
        <h2>${result.name}</h2>
        <p class="byline">By ${result.reporter}</p>
        <div class="content">${result.content}</div>
        <p class="timestamp">${new Date(result.timestamp).toLocaleString()}</p>
    </article>
</body>
</html>`;
    
    await fs.writeFile(filepath, htmlContent);
    
    newsItems.push({
      id: result.id,
      name: result.name,
      reporter: result.reporter,
      url: `./sections/${result.id}/${filename}`,
      timestamp: result.timestamp
    });
    
    console.log(`Saved ${result.name} to ${filepath}`);
  }
  
  // Update news.json
  const newsJsonPath = path.join(baseDir, '../public/news.json');
  await fs.writeFile(newsJsonPath, JSON.stringify({ 
    items: newsItems,
    generated: new Date().toISOString()
  }, null, 2));
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Content generation complete in ${duration}s`);
  console.log(`Generated ${newsItems.length} articles`);
}

/**
 * Calculate the next 1 AM time
 */
function getNext1AM() {
  const now = new Date();
  const next1AM = new Date();
  next1AM.setHours(1, 0, 0, 0);
  
  // If it's already past 1 AM today, schedule for tomorrow
  if (now >= next1AM) {
    next1AM.setDate(next1AM.getDate() + 1);
  }
  
  return next1AM;
}

/**
 * Format time for display
 */
function formatTime(date) {
  return date.toLocaleString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
}

/**
 * Start the scheduler for daily content generation at 1 AM with retry logic
 */
export function startTimer(configData, baseDir) {
  let currentGenerationAbortController = null;
  let retryTimeoutId = null;
  let nextScheduleTimeoutId = null;
  
  const RETRY_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
  
  /**
   * Attempt to generate content with cancellation support
   */
  async function attemptGeneration() {
    // Cancel any ongoing generation
    if (currentGenerationAbortController) {
      console.log('Cancelling previous generation attempt...');
      currentGenerationAbortController.abort();
    }
    
    // Create new abort controller for this attempt
    currentGenerationAbortController = new AbortController();
    const signal = currentGenerationAbortController.signal;
    
    try {
      console.log('Attempting content generation...');
      await generateAllSections(configData, baseDir, signal);
      
      // Success! Clear retry timeout and schedule next day
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
        retryTimeoutId = null;
      }
      
      console.log('Content generation successful!');
      scheduleNextDay();
      currentGenerationAbortController = null;
    } catch (error) {
      // Check if it was cancelled
      if (signal.aborted) {
        console.log('Generation was cancelled');
        return;
      }
      
      // Generation failed - log error and schedule retry
      console.error('Error during content generation:', error.message);
      console.log(`Scheduling retry in 10 minutes...`);
      
      // Cancel any existing retry timeout
      if (retryTimeoutId) {
        clearTimeout(retryTimeoutId);
      }
      
      // Schedule retry in 10 minutes
      retryTimeoutId = setTimeout(() => {
        retryTimeoutId = null;
        attemptGeneration();
      }, RETRY_INTERVAL_MS);
      
      currentGenerationAbortController = null;
    }
  }
  
  /**
   * Schedule the next day's generation at 1 AM
   */
  function scheduleNextDay() {
    // Clear any existing schedule
    if (nextScheduleTimeoutId) {
      clearTimeout(nextScheduleTimeoutId);
    }
    
    const next1AM = getNext1AM();
    const msUntil1AM = next1AM.getTime() - Date.now();
    
    console.log(`Next generation scheduled for: ${formatTime(next1AM)}`);
    console.log(`(in ${Math.round(msUntil1AM / 1000 / 60)} minutes)`);
    
    nextScheduleTimeoutId = setTimeout(() => {
      nextScheduleTimeoutId = null;
      attemptGeneration();
    }, msUntil1AM);
  }
  
  // Start the scheduler
  console.log('Scheduler initialized: Daily generation at 1 AM');
  console.log('Retry interval: 10 minutes on failure');
  
  // Schedule first run
  scheduleNextDay();
}

// Start the web server (only when run directly, not when imported)
// Check if this module is being run directly by comparing the resolved file paths
const isMainModule = import.meta.url === `file://${path.resolve(process.argv[1] || '')}`.replace(/\\/g, '/') ||
                     fileURLToPath(import.meta.url) === path.resolve(process.argv[1] || '');

if (isMainModule) {
  // Display configuration at startup
  displayConfig(config);
  
  server.listen(PORT, () => {
    console.log(`Daily Bugle server running on port ${PORT}`);
    console.log(`View the paper at http://localhost:${PORT}`);
    startTimer(config, __dirname);
  });
}
