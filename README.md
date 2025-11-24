# The Daily Bugle

*"Spider-Man: Threat or Menace? We Report, You Decide!"*

POC for connecting to cloud-hosted AI services (Ollama or LocalAI) and generating AI-powered news content on a timed basis. Because even J. Jonah Jameson needs some automation help to keep the presses running 24/7.

## 🕷️ What is This?

The Daily Bugle is a Node.js service that uses an external Ollama instance to generate fictional news articles in the style of Marvel's famous tabloid newspaper. It's perfect for stress-testing Ollama with multiple concurrent requests while having a bit of fun!

### Features

- **Automated News Generation**: Configurable timer generates fresh content periodically
- **Parallel Ollama Requests**: All 10 news sections are generated simultaneously for maximum load testing
- **10 Fictional News Sections**:
  - Masthead slogan (J. Jonah Jameson's daily rant headline)
  - Weather Report
  - Spider-Man Sightings (always presented with appropriate skepticism)
  - Villain Activity Reports
  - Editorial (more Spider-Man criticism)
  - City News
  - Sports
  - Business
  - Arts & Culture
  - Human Interest Stories
- **Classic Newspaper UI**: A single-page HTML newspaper styled after the Daily Bugle
- **Static File Generation**: Each article is saved as a timestamped HTML file
- **Docker Ready**: Containerized for easy deployment

## 🚀 Quick Start (Development)

### Prerequisites

- Node.js 20 or higher
- Access to an Ollama instance (configured in `config/sections.json`)

### Installation

```bash
# Clone the repository
git clone https://github.com/lbsa71/DailyBugle.git
cd DailyBugle

# Install dependencies
npm install

# Start the service
npm start
```

The service will:
1. Start a web server on port 3000 (configurable via PORT environment variable)
2. Immediately generate the first batch of articles (if `runOnStartup` is true)
3. Continue generating new articles on the configured timer interval

Visit `http://localhost:3000` to see your freshly generated Daily Bugle!

### Development Mode

For auto-restart on file changes:

```bash
npm run dev
```

## 🐳 Docker Deployment

### Building the Image

```bash
docker build -t daily-bugle .
```

### Running the Container

```bash
docker run -p 3000:3000 daily-bugle
```

### Using Docker Hub

The GitHub Actions workflow automatically builds and pushes images to Docker Hub on every push to main. To use:

```bash
docker pull <your-username>/daily-bugle:latest
docker run -p 3000:3000 <your-username>/daily-bugle:latest
```

**Note**: You'll need to configure `DOCKER_USERNAME` and `DOCKER_PASSWORD` secrets in your GitHub repository settings.

## ⚙️ Configuration

Edit `config/sections.json` to customize:

### AI Provider Configuration

The Daily Bugle supports multiple AI providers. Choose the one that fits your setup:

#### Ollama Provider
```json
"provider": {
  "type": "ollama",
  "config": {
    "baseUrl": "https://ollama.lbsa71.net",
    "model": "mistral:instruct",
    "temperature": 0.8
  }
}
```

#### LocalAI Provider (OpenAI-compatible)
```json
"provider": {
  "type": "localai",
  "config": {
    "baseUrl": "http://localhost:8080",
    "model": "gpt-3.5-turbo",
    "temperature": 0.8,
    "apiKey": ""
  }
}
```

**Note:** The `apiKey` field is optional for LocalAI and only required if your LocalAI instance requires authentication.

**Backward Compatibility:** The old `ollamaConfig` format is still supported and will be automatically converted to the new provider format.

### Timer Configuration
```json
"timerConfig": {
  "intervalMinutes": 60,
  "runOnStartup": true
}
```

### Adding/Modifying Sections

Each section in the `sections` array can be customized:
- `id`: Unique identifier (used for file paths)
- `name`: Display name
- `reporter`: Fictional reporter name
- `systemPrompt`: AI system context
- `sectionPrompt`: What to generate

## 📁 Project Structure

```
DailyBugle/
├── config/
│   ├── sections.json              # Configuration for news sections and AI provider
│   └── sections.localai.example.json  # Example LocalAI configuration
├── src/
│   ├── index.js                   # Main Node.js service
│   ├── index.test.js              # Integration tests
│   ├── providers.test.js          # Provider tests
│   └── providers/                 # AI provider implementations
│       ├── base-provider.js       # Base provider interface
│       ├── ollama-provider.js     # Ollama provider
│       ├── localai-provider.js    # LocalAI provider
│       ├── provider-factory.js    # Provider factory
│       └── index.js               # Module exports
├── public/
│   ├── index.html                 # Static newspaper UI
│   ├── news.json                  # Generated index of articles (auto-created)
│   └── sections/                  # Generated article files (auto-created)
│       ├── masthead/
│       ├── weather/
│       └── ...
├── .github/
│   └── workflows/
│       └── docker-build.yml       # CI/CD for Docker builds
├── Dockerfile
├── .dockerignore
└── package.json
```

## 🕸️ How It Works

1. **Timer Triggers**: Based on `intervalMinutes` configuration
2. **Parallel Generation**: All sections call the configured AI provider API simultaneously
3. **Content Storage**: Each article saved to `public/sections/{section-id}/{date-time}.html`
4. **Index Update**: `public/news.json` updated with references to new articles
5. **Frontend Display**: HTML page fetches `news.json` and displays articles in newspaper format

## 🔌 Supported AI Providers

- **Ollama**: Self-hosted AI models (https://ollama.ai)
- **LocalAI**: OpenAI-compatible local AI server (https://localai.io)

The provider pattern makes it easy to add support for additional AI services in the future.

## 🎨 Customization Tips

Want to make J.J.J. proud? Here are some ideas:

- Switch between Ollama and LocalAI providers by updating the `provider.type` in config
- Modify section prompts to change the tone or content style
- Add more sections (just extend the `sections` array)
- Adjust the temperature for more/less creative content
- Change the timer interval to generate more/less frequently
- Customize the CSS in `public/index.html` for different newspaper styles

## 🐛 Troubleshooting

**"Error calling AI provider"**: Check that your AI service is accessible at the configured URL.

**No content generated**: Check console logs for errors. Ensure `runOnStartup` is `true` or wait for the timer interval.

**Provider configuration errors**: Ensure your `provider.type` is either 'ollama' or 'localai', and all required config fields are provided.

**Docker secrets not working**: Make sure `DOCKER_USERNAME` and `DOCKER_PASSWORD` are set in GitHub repository secrets.

## 📝 License

MIT License - Feel free to use this for your own Ollama stress testing! (Though J. Jonah Jameson might sue for copyright infringement if you use his name without permission.)

## 🦸 Contributing

Pull requests welcome! Just remember: with great code comes great responsibility.

---

*"Get me pictures of Spider-Man! And also some AI-generated news articles!"* - J. Jonah Jameson (probably)
