# RAG Service

This folder contains a Retrieval-Augmented Generation (RAG) service implementation that combines FAISS vector similarity search with Hugging Face's sentence transformers for text embeddings.

## Components

### Core Files
- `setup.js`: Node.js script that sets up the RAG environment
  - Creates `.rag` directory in git root
  - Sets up Python virtual environment
  - Installs required packages (FAISS, sentence-transformers, Flask)
  - Copies service files to the `.rag` directory

- `app.py`: Flask API server
  - Provides REST endpoints for adding and searching text
  - Integrates EmbeddingManager and FAISSManager
  - Runs on port 5050

- `embedding_manager.py`: Text embedding service
  - Uses Hugging Face's sentence-transformers
  - Default model: 'all-MiniLM-L6-v2' (384-dimensional embeddings)
  - Converts text to dense vector representations

- `faiss_manager.py`: Vector similarity search
  - Manages FAISS index for efficient similarity search
  - Persists index to disk (`faiss_index.bin`)
  - Maintains text lookup table (`faiss_index.bin.lookup`)

- `start.js`: Server startup script
  - Launches Flask server
  - Handles process management and cleanup

## Setup

1. Run the setup script:
```bash
node src/services/rag/setup.js
```

2. Start the server:
```bash
cd .rag && node start.js
```

## API Usage

### Add Text to Index
```bash
curl -X POST http://localhost:5050/add \
  -H "Content-Type: application/json" \
  -d '{"text": "Your text to be indexed"}'
```

Response:
```json
{
  "status": "success",
  "total_vectors": 1
}
```

### Search Similar Texts
```bash
curl -X POST http://localhost:5050/search \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Your search query",
    "k": 5
  }'
```

Response:
```json
{
  "results": [
    {
      "text": "Original text that was indexed",
      "distance": 0.123,
      "index": 0
    },
    ...
  ]
}
```

## Technical Details

### Text Embeddings
- Model: all-MiniLM-L6-v2
- Embedding dimension: 384
- Optimized for semantic similarity search
- Multilingual support
- Fast inference speed

### FAISS Index
- Type: IndexFlatL2 (L2 distance for similarity)
- Persistence: Index saved to `faiss_index.bin`
- Text lookup: Original texts stored in `faiss_index.bin.lookup`
- Automatic index loading/creation

### Data Persistence
- FAISS index and text lookup are persisted between server restarts
- Located in the `.rag` directory
- Automatically initialized if not present

## Development

### Adding New Features
1. Embedding customization: Modify `embedding_manager.py` to use different models
2. Index types: Extend `faiss_manager.py` to support different FAISS index types
3. API endpoints: Add new routes in `app.py`

### File Organization
```
src/services/rag/
├── README.md           # This documentation
├── setup.js           # Environment setup
├── app.py            # Flask API server
├── embedding_manager.py # Text embedding service
├── faiss_manager.py  # Vector similarity search
└── start.js          # Server startup script
```

### Generated Files (in .rag/)
```
.rag/
├── venv/             # Python virtual environment
├── app.py           # Copied from src
├── embedding_manager.py
├── faiss_manager.py
├── start.js
├── faiss_index.bin   # Persisted FAISS index
└── faiss_index.bin.lookup # Text lookup table
