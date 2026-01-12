# Accordo Embedding Service

A FastAPI microservice for generating vector embeddings using HuggingFace's `BAAI/bge-large-en-v1.5` model.

## Features

- **1024-dimensional embeddings** using state-of-the-art BGE model
- **Single and batch embedding** endpoints
- **Cosine similarity** computation
- **GPU acceleration** support (CUDA, Apple Silicon MPS)
- **Normalized embeddings** for efficient similarity search

## Quick Start

### Option 1: Local Python

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows

# Install dependencies
pip install -r requirements.txt

# Run the service
python main.py
```

### Option 2: Docker

```bash
# Build the image
docker build -t accordo-embedding-service .

# Run the container
docker run -p 8001:8001 accordo-embedding-service
```

## API Endpoints

### Health Check
```bash
GET /health
```

### Single Text Embedding
```bash
POST /embed
Content-Type: application/json

{
  "text": "Your text to embed",
  "instruction": "Optional: Represent this sentence for retrieval"
}
```

### Batch Embedding
```bash
POST /embed/batch
Content-Type: application/json

{
  "texts": ["First text", "Second text", "Third text"],
  "instruction": "Optional instruction prefix"
}
```

### Similarity Computation
```bash
POST /similarity
Content-Type: application/json

{
  "text1": "First text",
  "text2": "Second text"
}
```

## Configuration

Environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `EMBEDDING_MODEL` | `BAAI/bge-large-en-v1.5` | HuggingFace model to use |
| `EMBEDDING_SERVICE_PORT` | `8001` | Port to run the service |
| `MAX_BATCH_SIZE` | `32` | Maximum texts per batch for GPU efficiency |

## Model Information

- **Model**: BAAI/bge-large-en-v1.5
- **Dimensions**: 1024
- **Max Sequence Length**: 512 tokens
- **Similarity Function**: Cosine similarity (embeddings are normalized)

For retrieval tasks, use the instruction prefix:
```json
{
  "text": "What is the capital of France?",
  "instruction": "Represent this sentence for retrieval"
}
```

## Performance

- Single embedding: ~10-50ms (GPU) / ~100-300ms (CPU)
- Batch of 32: ~100-200ms (GPU) / ~2-5s (CPU)
- Model loading: ~5-15s on first start
