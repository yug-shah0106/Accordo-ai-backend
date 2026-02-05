NODE_ENV=development
PORT=8000
LOG_LEVEL=info

DB_HOST=127.0.0.1
DB_PORT=5432
DB_NAME=accordo
DB_USERNAME=postgres
DB_PASSWORD=postgres
DB_SSL=false
DB_SSL_REJECT_UNAUTHORIZED=true
DB_ADMIN_DATABASE=postgres

JWT_SECRET=change-me
JWT_ACCESS_TOKEN_SECRET=
JWT_REFRESH_TOKEN_SECRET=
JWT_ACCESS_EXPIRY=1h
JWT_REFRESH_EXPIRY=7d

RATE_LIMIT_WINDOW=900000
RATE_LIMIT_MAX=100

SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM_EMAIL=

REDIS_URL=redis://localhost:6379

# OpenAI Configuration (optional - for fallback)
OPENAI_API_KEY=

# Local LLM Configuration (Ollama)
# Base URL where Ollama is running (default: http://localhost:11434)
LLM_BASE_URL=http://localhost:11434

# Model name to use (default: qwen3)
# Available models: qwen3, llama3.2, mistral, etc.
# Run 'ollama list' to see available models
LLM_MODEL=qwen3

# Request timeout in milliseconds (default: 60000 = 60 seconds)
LLM_TIMEOUT=60000
