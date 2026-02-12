# Embedding Service — DEPRECATED

This Python FastAPI embedding service has been replaced by a built-in TypeScript provider system in the main backend.

## What replaced it

The embedding functionality is now handled by `src/modules/vector/providers/` with support for:

- **`local`** — `@huggingface/transformers` (ONNX, runs on CPU in Node.js). Default for development.
- **`openai`** — OpenAI Embeddings API (`text-embedding-3-small`).
- **`bedrock`** — Amazon Bedrock Titan Embed Text v2.

## How to configure

Set `EMBEDDING_PROVIDER` in your `.env` file:

```env
EMBEDDING_PROVIDER=local    # or: openai, bedrock
```

See `.env.example` for full configuration options.

## Why this directory still exists

This directory is kept temporarily to allow rollback if needed. It can be safely deleted once the new provider system is verified in production.
