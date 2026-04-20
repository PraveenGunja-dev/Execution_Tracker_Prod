#!/usr/bin/env python3
"""
rag_auto.py  –  Auto-build FAISS index on startup if missing.
Delegates to the production build_embeddings_v2 pipeline.
"""

import os
import sys


def build_index() -> bool:
    """
    Build the FAISS index + embeddings DB.
    Called automatically by chat.py if the index files are missing.
    """
    print("[rag_auto] Delegating to build_embeddings_v2 …")

    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    sys.path.insert(0, BASE_DIR)

    try:
        from scripts.build_embeddings_v2 import build
        build()
        return True
    except Exception as e:
        print(f"[rag_auto] Build failed: {e}")
        import traceback
        traceback.print_exc()
        return False


if __name__ == "__main__":
    build_index()
