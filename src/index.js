import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

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
 * Call Ollama API to generate content
 */
async function callOllama(systemPrompt, userPrompt) {
  const url = `${config.ollamaConfig.baseUrl}/api/generate`;
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.ollamaConfig.model,
        prompt: userPrompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: config.ollamaConfig.temperature
        }
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.response;
  } catch (error) {
    console.error('Error calling Ollama:', error);
    return `Error generating content: ${error.message}`;
  }
}

/**
 * Generate content for a single section
 */
async function generateSection(section) {
  console.log(`Generating ${section.name} by ${section.reporter}...`);
  const content = await callOllama(section.systemPrompt, section.sectionPrompt);
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
async function generateAllSections() {
  console.log('Starting content generation...');
  const startTime = Date.now();
  
  // Generate all sections in parallel
  const results = await Promise.all(
    config.sections.map(section => generateSection(section))
  );
  
  // Create timestamp for filenames
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
  const timeHour = new Date().toISOString().split('T')[1].substring(0, 5).replace(':', '-');
  const dateFolder = `${timestamp}_${timeHour}`;
  
  // Save each section to a file
  const newsItems = [];
  for (const result of results) {
    const sectionDir = path.join(__dirname, '../public/sections', result.id);
    await fs.mkdir(sectionDir, { recursive: true });
    
    const filename = `${dateFolder}.html`;
    const filepath = path.join(sectionDir, filename);
    
    // Create HTML content
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
      url: `/sections/${result.id}/${filename}`,
      timestamp: result.timestamp
    });
    
    console.log(`Saved ${result.name} to ${filepath}`);
  }
  
  // Update news.json
  const newsJsonPath = path.join(__dirname, '../public/news.json');
  await fs.writeFile(newsJsonPath, JSON.stringify({ 
    items: newsItems,
    generated: new Date().toISOString()
  }, null, 2));
  
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`Content generation complete in ${duration}s`);
  console.log(`Generated ${newsItems.length} articles`);
}

/**
 * Start the timer for periodic content generation
 */
function startTimer() {
  const intervalMs = config.timerConfig.intervalMinutes * 60 * 1000;
  
  console.log(`Timer set to run every ${config.timerConfig.intervalMinutes} minutes`);
  
  if (config.timerConfig.runOnStartup) {
    console.log('Running initial generation on startup...');
    generateAllSections().catch(error => {
      console.error('Error during initial generation:', error);
    });
  }
  
  setInterval(() => {
    generateAllSections().catch(error => {
      console.error('Error during scheduled generation:', error);
    });
  }, intervalMs);
}

// Start the web server
app.listen(PORT, () => {
  console.log(`Daily Bugle server running on port ${PORT}`);
  console.log(`View the paper at http://localhost:${PORT}`);
  startTimer();
});
