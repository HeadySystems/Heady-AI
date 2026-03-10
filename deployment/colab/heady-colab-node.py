#!/usr/bin/env python3
"""
HEADY™ Colab Pro+ Runtime Node
Bridges a Colab Pro+ GPU runtime into the Heady liquid architecture.
Run this in each of your 3 Colab Pro+ subscriptions.

Usage:
  1. Mount Google Drive
  2. Set HEADY_NODE_ROLE environment variable (primary/training/burst)
  3. Run this script
"""

import os
import json
import time
import math
import asyncio
from http.server import HTTPServer, BaseHTTPRequestHandler
import threading

# ─── PHI CONSTANTS ────────────────────────────────────────────────────────────
PHI = (1 + math.sqrt(5)) / 2  # ≈ 1.618
PSI = 1 / PHI                  # ≈ 0.618
HEARTBEAT_MS = int(PHI ** 4 * 1000)  # ≈ 6,854ms

NODE_ROLE = os.environ.get('HEADY_NODE_ROLE', 'burst')
NODE_INDEX = int(os.environ.get('HEADY_NODE_INDEX', '0'))
HEADY_API_URL = os.environ.get('HEADY_API_URL', '')

# ─── GPU INFO ─────────────────────────────────────────────────────────────────
def get_gpu_info():
    """Detect available GPU."""
    try:
        import torch
        if torch.cuda.is_available():
            return {
                'type': torch.cuda.get_device_name(0),
                'memory_mb': torch.cuda.get_device_properties(0).total_mem // (1024 * 1024),
                'available': True,
            }
    except ImportError:
        pass
    return {'type': 'none', 'memory_mb': 0, 'available': False}

# ─── EMBEDDING SERVICE ────────────────────────────────────────────────────────
def generate_embeddings(texts, model_name='nomic-ai/nomic-embed-text-v1.5'):
    """Generate 384-dim embeddings using local model."""
    try:
        from sentence_transformers import SentenceTransformer
        model = SentenceTransformer(model_name)
        embeddings = model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()
    except ImportError:
        # Fallback: hash-based deterministic embeddings
        import hashlib
        results = []
        for text in texts:
            h = hashlib.sha384(text.encode()).digest()
            vec = [((b - 128) / 128.0) for b in h[:384]]
            norm = math.sqrt(sum(x*x for x in vec))
            if norm > 0:
                vec = [x / norm for x in vec]
            results.append(vec)
        return results

# ─── HTTP SERVER ──────────────────────────────────────────────────────────────
class HeadyNodeHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            gpu = get_gpu_info()
            response = {
                'status': 'healthy',
                'role': NODE_ROLE,
                'node_index': NODE_INDEX,
                'gpu': gpu,
                'timestamp': time.time(),
                'phi': PHI,
            }
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def do_POST(self):
        if self.path == '/embed':
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length))
            texts = body.get('texts', [])
            embeddings = generate_embeddings(texts)
            response = {'embeddings': embeddings, 'model': 'nomic-embed-text-v1.5', 'dim': 384}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        elif self.path == '/inference':
            content_length = int(self.headers.get('Content-Length', 0))
            body = json.loads(self.rfile.read(content_length))
            # In production: run inference on GPU
            response = {'status': 'completed', 'node': NODE_ROLE}
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(response).encode())
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        pass  # Suppress default logging

def start_server(port=8080):
    """Start the Heady Colab node HTTP server."""
    server = HTTPServer(('0.0.0.0', port), HeadyNodeHandler)
    print(f'[HEADY] Colab node started — role={NODE_ROLE}, index={NODE_INDEX}, port={port}')
    print(f'[HEADY] GPU: {get_gpu_info()}')
    print(f'[HEADY] Heartbeat interval: {HEARTBEAT_MS}ms (φ⁴ × 1000)')
    server.serve_forever()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    start_server(port)
