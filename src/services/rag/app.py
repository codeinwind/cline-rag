from flask import Flask, request, jsonify
from embedding_manager import EmbeddingManager
from faiss_manager import FAISSManager

app = Flask(__name__)

# Initialize managers
embedding_manager = EmbeddingManager()
faiss_manager = FAISSManager(embedding_manager)

@app.route('/add', methods=['POST'])
def add_text():
    data = request.json
    if 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    total_vectors = faiss_manager.add_text(data['text'])
    return jsonify({
        "status": "success",
        "total_vectors": total_vectors
    })

@app.route('/search', methods=['POST'])
def search():
    data = request.json
    if 'text' not in data:
        return jsonify({"error": "No text provided"}), 400
    
    results = faiss_manager.search(
        data['text'],
        k=data.get('k', 5)
    )
    return jsonify({
        "results": results
    })

if __name__ == '__main__':
    app.run(port=5050)
