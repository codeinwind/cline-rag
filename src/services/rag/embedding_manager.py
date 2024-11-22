from sentence_transformers import SentenceTransformer

class EmbeddingManager:
    def __init__(self, model_name='all-MiniLM-L6-v2'):
        print(f"Loading sentence transformer model: {model_name}")
        self.model = SentenceTransformer(model_name)
        self.dimension = self.model.get_sentence_embedding_dimension()
        print(f"Model loaded with embedding dimension: {self.dimension}")
    
    def get_embedding(self, text):
        """Convert text to embedding vector"""
        return self.model.encode([text])[0]
