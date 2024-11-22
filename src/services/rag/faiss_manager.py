import faiss
import numpy as np
import os
import json

class FAISSManager:
    def __init__(self, embedding_manager, index_path='faiss_index.bin'):
        self.embedding_manager = embedding_manager
        self.index_path = index_path
        self.dimension = embedding_manager.dimension
        self.text_lookup = {}  # Store original text for each index
        self.load_or_create_index()

    def load_or_create_index(self):
        """Load existing FAISS index or create a new one"""
        if os.path.exists(self.index_path):
            print(f"Loading existing FAISS index from {self.index_path}")
            self.index = faiss.read_index(self.index_path)
            print(f"Loaded index with {self.index.ntotal} vectors")
            # Load text lookup if exists
            lookup_path = self.index_path + '.lookup'
            if os.path.exists(lookup_path):
                with open(lookup_path, 'r') as f:
                    self.text_lookup = json.load(f)
        else:
            print("Creating new FAISS index")
            self.index = faiss.IndexFlatL2(self.dimension)
            self.save_index()

    def save_index(self):
        """Save the FAISS index and text lookup to disk"""
        faiss.write_index(self.index, self.index_path)
        # Save text lookup
        lookup_path = self.index_path + '.lookup'
        with open(lookup_path, 'w') as f:
            json.dump(self.text_lookup, f)
        print(f"Saved index with {self.index.ntotal} vectors")

    def add_text(self, text):
        """Convert text to embedding and add to index"""
        vector = self.embedding_manager.get_embedding(text)
        vector = np.array(vector, dtype='float32').reshape(1, -1)
        self.index.add(vector)
        # Store text in lookup
        self.text_lookup[str(self.index.ntotal - 1)] = text
        self.save_index()
        return self.index.ntotal

    def search(self, text, k=5):
        """Search for similar texts"""
        vector = self.embedding_manager.get_embedding(text)
        vector = np.array(vector, dtype='float32').reshape(1, -1)
        distances, indices = self.index.search(vector, k)
        
        # Convert indices to original texts
        results = []
        for i, idx in enumerate(indices[0]):
            results.append({
                'text': self.text_lookup.get(str(idx), f"Unknown text at index {idx}"),
                'distance': float(distances[0][i]),
                'index': int(idx)
            })
        return results
