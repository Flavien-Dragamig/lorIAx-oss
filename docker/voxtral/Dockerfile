# ===========================================================================
# Voxtral Realtime ASR — vLLM + FastAPI adapter
# Requiert un GPU >= 16 Go VRAM (NVIDIA, CUDA)
#
# L'image vLLM inclut CUDA, PyTorch, et toutes les dépendances GPU.
# Le serveur FastAPI (port 9001) traduit l'API Whisper vers vLLM (port 8000).
# ===========================================================================

FROM vllm/vllm-openai:latest

WORKDIR /app

# Audio processing dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg libsndfile1 curl git && \
    rm -rf /var/lib/apt/lists/*

# vLLM omni plugin (required for Voxtral audio models)
RUN pip install --no-cache-dir \
    "git+https://github.com/vllm-project/vllm-omni.git" \
    soxr librosa soundfile

# FastAPI adapter dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY server.py .

# Adapter on :9001, vLLM on :8000 (internal)
EXPOSE 9001

HEALTHCHECK --interval=30s --timeout=10s --retries=3 --start-period=300s \
  CMD curl -sf http://localhost:9001/health || exit 1

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "9001"]
