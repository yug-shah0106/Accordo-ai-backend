"""
Embedding Service - FastAPI microservice for generating vector embeddings
using HuggingFace's BAAI/bge-large-en-v1.5 model (1024 dimensions)
"""

import os
import time
import logging
from typing import List, Optional
from contextlib import asynccontextmanager

import torch
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sentence_transformers import SentenceTransformer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration
MODEL_NAME = os.getenv("EMBEDDING_MODEL", "BAAI/bge-large-en-v1.5")
EMBEDDING_DIMENSION = 1024
MAX_BATCH_SIZE = int(os.getenv("MAX_BATCH_SIZE", "32"))
PORT = int(os.getenv("EMBEDDING_SERVICE_PORT", "5003"))

# Global model instance
model: Optional[SentenceTransformer] = None


# Request/Response models
class EmbedRequest(BaseModel):
    text: str = Field(..., description="Text to embed")
    instruction: Optional[str] = Field(
        default=None,
        description="Optional instruction prefix for the embedding (for retrieval tasks)"
    )


class EmbedBatchRequest(BaseModel):
    texts: List[str] = Field(..., description="List of texts to embed")
    instruction: Optional[str] = Field(
        default=None,
        description="Optional instruction prefix for all texts"
    )


class EmbedResponse(BaseModel):
    embedding: List[float] = Field(..., description="Vector embedding")
    dimension: int = Field(..., description="Embedding dimension")
    model: str = Field(..., description="Model used")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class EmbedBatchResponse(BaseModel):
    embeddings: List[List[float]] = Field(..., description="List of vector embeddings")
    dimension: int = Field(..., description="Embedding dimension")
    count: int = Field(..., description="Number of embeddings generated")
    model: str = Field(..., description="Model used")
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class HealthResponse(BaseModel):
    status: str
    model: str
    dimension: int
    device: str
    gpu_available: bool
    gpu_name: Optional[str] = None


class SimilarityRequest(BaseModel):
    text1: str = Field(..., description="First text")
    text2: str = Field(..., description="Second text")


class SimilarityResponse(BaseModel):
    similarity: float = Field(..., description="Cosine similarity score (0-1)")
    processing_time_ms: float


def load_model() -> SentenceTransformer:
    """Load the embedding model with optimal device configuration"""
    global model

    logger.info(f"Loading embedding model: {MODEL_NAME}")
    start_time = time.time()

    # Determine device
    if torch.cuda.is_available():
        device = "cuda"
        logger.info(f"Using GPU: {torch.cuda.get_device_name(0)}")
    elif torch.backends.mps.is_available():
        device = "mps"
        logger.info("Using Apple Silicon MPS")
    else:
        device = "cpu"
        logger.info("Using CPU")

    # Load model
    model = SentenceTransformer(MODEL_NAME, device=device)

    # Warm up the model with a test embedding
    _ = model.encode("warm up", convert_to_numpy=True)

    load_time = time.time() - start_time
    logger.info(f"Model loaded in {load_time:.2f}s on {device}")

    return model


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifecycle manager for FastAPI app"""
    # Startup
    load_model()
    yield
    # Shutdown
    logger.info("Shutting down embedding service")


# Create FastAPI app
app = FastAPI(
    title="Accordo Embedding Service",
    description="Vector embedding service using BAAI/bge-large-en-v1.5",
    version="1.0.0",
    lifespan=lifespan
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_embedding(text: str, instruction: Optional[str] = None) -> List[float]:
    """Generate embedding for a single text"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # BGE models work best with instruction prefixes for retrieval
    if instruction:
        text = f"{instruction}: {text}"

    embedding = model.encode(text, convert_to_numpy=True, normalize_embeddings=True)
    return embedding.tolist()


def get_embeddings_batch(texts: List[str], instruction: Optional[str] = None) -> List[List[float]]:
    """Generate embeddings for a batch of texts"""
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")

    # Apply instruction prefix if provided
    if instruction:
        texts = [f"{instruction}: {text}" for text in texts]

    embeddings = model.encode(
        texts,
        convert_to_numpy=True,
        normalize_embeddings=True,
        batch_size=min(len(texts), MAX_BATCH_SIZE),
        show_progress_bar=False
    )
    return embeddings.tolist()


@app.get("/health", response_model=HealthResponse)
async def health_check():
    """Health check endpoint"""
    device = "unknown"
    gpu_available = torch.cuda.is_available()
    gpu_name = None

    if model is not None:
        device = str(model.device)
        if gpu_available:
            gpu_name = torch.cuda.get_device_name(0)

    return HealthResponse(
        status="healthy" if model is not None else "loading",
        model=MODEL_NAME,
        dimension=EMBEDDING_DIMENSION,
        device=device,
        gpu_available=gpu_available,
        gpu_name=gpu_name
    )


@app.post("/embed", response_model=EmbedResponse)
async def embed_text(request: EmbedRequest):
    """Generate embedding for a single text"""
    start_time = time.time()

    try:
        embedding = get_embedding(request.text, request.instruction)
        processing_time = (time.time() - start_time) * 1000

        return EmbedResponse(
            embedding=embedding,
            dimension=len(embedding),
            model=MODEL_NAME,
            processing_time_ms=round(processing_time, 2)
        )
    except Exception as e:
        logger.error(f"Error generating embedding: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/embed/batch", response_model=EmbedBatchResponse)
async def embed_batch(request: EmbedBatchRequest):
    """Generate embeddings for multiple texts"""
    start_time = time.time()

    if len(request.texts) == 0:
        raise HTTPException(status_code=400, detail="texts list cannot be empty")

    if len(request.texts) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 texts per batch")

    try:
        embeddings = get_embeddings_batch(request.texts, request.instruction)
        processing_time = (time.time() - start_time) * 1000

        return EmbedBatchResponse(
            embeddings=embeddings,
            dimension=EMBEDDING_DIMENSION,
            count=len(embeddings),
            model=MODEL_NAME,
            processing_time_ms=round(processing_time, 2)
        )
    except Exception as e:
        logger.error(f"Error generating batch embeddings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/similarity", response_model=SimilarityResponse)
async def compute_similarity(request: SimilarityRequest):
    """Compute cosine similarity between two texts"""
    start_time = time.time()

    try:
        embeddings = get_embeddings_batch([request.text1, request.text2])

        # Compute cosine similarity (embeddings are already normalized)
        import numpy as np
        similarity = float(np.dot(embeddings[0], embeddings[1]))

        processing_time = (time.time() - start_time) * 1000

        return SimilarityResponse(
            similarity=round(similarity, 6),
            processing_time_ms=round(processing_time, 2)
        )
    except Exception as e:
        logger.error(f"Error computing similarity: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/")
async def root():
    """Root endpoint with service info"""
    return {
        "service": "Accordo Embedding Service",
        "model": MODEL_NAME,
        "dimension": EMBEDDING_DIMENSION,
        "endpoints": {
            "health": "/health",
            "embed": "POST /embed",
            "embed_batch": "POST /embed/batch",
            "similarity": "POST /similarity"
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=PORT)
