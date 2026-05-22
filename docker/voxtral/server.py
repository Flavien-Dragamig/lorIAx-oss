"""
Voxtral Realtime ASR Adapter — Proxy FastAPI compatible Whisper devant vLLM.

Architecture :
  1. vLLM sert le modèle Voxtral-Mini-4B-Realtime sur :8000 (processus séparé)
  2. Ce serveur FastAPI expose une API compatible Whisper sur :9001
  3. Les appels /asr sont traduits vers l'API vLLM /v1/audio/transcriptions

Prérequis : GPU >= 16 Go VRAM (le modèle tourne en BF16).
"""

import os
import io
import time
import logging
import subprocess
import threading
from pathlib import Path

import httpx
from fastapi import FastAPI, File, Query, UploadFile
from fastapi.responses import HTMLResponse, JSONResponse
from pydub import AudioSegment

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("voxtral-adapter")

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MODEL_ID = os.environ.get("VOXTRAL_MODEL", "mistralai/Voxtral-Mini-4B-Realtime-2602")
VLLM_HOST = "127.0.0.1"
VLLM_PORT = int(os.environ.get("VLLM_PORT", "8000"))
VLLM_BASE_URL = f"http://{VLLM_HOST}:{VLLM_PORT}"
MAX_MODEL_LEN = int(os.environ.get("VLLM_MAX_MODEL_LEN", "131072"))

# ---------------------------------------------------------------------------
# Global state
# ---------------------------------------------------------------------------
app = FastAPI(title="Voxtral Realtime ASR Adapter")

server_state = {
    "status": "initializing",  # initializing | starting_vllm | ready | error
    "model": MODEL_ID,
    "error": None,
    "vllm_pid": None,
}

_vllm_process: subprocess.Popen | None = None


# ---------------------------------------------------------------------------
# vLLM lifecycle
# ---------------------------------------------------------------------------
def _start_vllm():
    """Launch vLLM serve as a subprocess."""
    global _vllm_process

    try:
        server_state["status"] = "starting_vllm"
        logger.info("Starting vLLM with model %s on port %d ...", MODEL_ID, VLLM_PORT)

        cmd = [
            "vllm", "serve", MODEL_ID,
            "--host", VLLM_HOST,
            "--port", str(VLLM_PORT),
            "--max-model-len", str(MAX_MODEL_LEN),
            "--compilation_config", '{"cudagraph_mode": "PIECEWISE"}',
        ]

        # Pass HF_TOKEN if available
        env = os.environ.copy()

        _vllm_process = subprocess.Popen(
            cmd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
        )
        server_state["vllm_pid"] = _vllm_process.pid
        logger.info("vLLM process started (PID %d)", _vllm_process.pid)

        # Stream vLLM logs in background
        def _stream_logs():
            if _vllm_process and _vllm_process.stdout:
                for line in _vllm_process.stdout:
                    logger.info("[vllm] %s", line.decode().rstrip())

        threading.Thread(target=_stream_logs, daemon=True).start()

        # Wait for vLLM to be ready
        _wait_for_vllm()

    except Exception as exc:
        server_state["status"] = "error"
        server_state["error"] = str(exc)
        logger.error("Failed to start vLLM: %s", exc)


def _wait_for_vllm():
    """Poll vLLM health endpoint until ready (max 5 min for model download)."""
    max_wait = 300  # 5 min
    interval = 3
    elapsed = 0

    while elapsed < max_wait:
        try:
            resp = httpx.get(f"{VLLM_BASE_URL}/health", timeout=5)
            if resp.status_code == 200:
                server_state["status"] = "ready"
                logger.info("vLLM is ready after %ds", elapsed)
                return
        except (httpx.ConnectError, httpx.ReadTimeout):
            pass

        time.sleep(interval)
        elapsed += interval

    server_state["status"] = "error"
    server_state["error"] = f"vLLM not ready after {max_wait}s"
    logger.error("vLLM failed to start within %ds", max_wait)


@app.on_event("startup")
def _on_startup():
    thread = threading.Thread(target=_start_vllm, daemon=True)
    thread.start()


@app.on_event("shutdown")
def _on_shutdown():
    if _vllm_process:
        logger.info("Stopping vLLM (PID %d) ...", _vllm_process.pid)
        _vllm_process.terminate()
        _vllm_process.wait(timeout=10)


# ---------------------------------------------------------------------------
# Utility
# ---------------------------------------------------------------------------
def _convert_to_wav(file_bytes: bytes, filename: str) -> bytes:
    """Convert uploaded audio to 16kHz mono WAV bytes."""
    ext = Path(filename).suffix.lower().lstrip(".")
    format_map = {"ogg": "ogg", "mp3": "mp3", "wav": "wav", "webm": "webm"}
    fmt = format_map.get(ext, "ogg")

    audio = AudioSegment.from_file(io.BytesIO(file_bytes), format=fmt)
    audio = audio.set_frame_rate(16000).set_channels(1)

    buf = io.BytesIO()
    audio.export(buf, format="wav")
    return buf.getvalue()


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@app.get("/health")
def health():
    """Health check — returns adapter and vLLM status."""
    return JSONResponse(
        content={
            "status": server_state["status"],
            "model": server_state["model"],
            "vllm_pid": server_state["vllm_pid"],
            "error": server_state["error"],
        },
        status_code=200 if server_state["status"] == "ready" else 503,
    )


@app.get("/docs", response_class=HTMLResponse)
def docs():
    """Compatibility with Whisper health check pattern."""
    return f"""
    <html><body>
    <h1>Voxtral Realtime ASR Adapter</h1>
    <p>Model: {MODEL_ID}</p>
    <p>Status: {server_state['status']}</p>
    <p>vLLM backend: {VLLM_BASE_URL}</p>
    <p><a href="/health">/health</a> — JSON health check</p>
    <p><a href="/asr">/asr</a> — POST audio for transcription (Whisper-compatible)</p>
    </body></html>
    """


@app.post("/asr")
async def transcribe(
    audio_file: UploadFile = File(...),
    language: str = Query(default="fr"),
    output: str = Query(default="json"),
    word_timestamps: bool = Query(default=True),
):
    """
    Whisper-compatible ASR endpoint.
    Accepts audio via multipart/form-data, returns JSON with text/segments.
    Internally proxies to vLLM's OpenAI-compatible audio transcription API.
    """
    if server_state["status"] != "ready":
        return JSONResponse(
            content={
                "error": f"Model not ready (status: {server_state['status']})",
                "detail": server_state.get("error"),
            },
            status_code=503,
        )

    try:
        file_bytes = await audio_file.read()
        filename = audio_file.filename or "audio.ogg"
        logger.info("Transcribing %s (%d bytes, language=%s)", filename, len(file_bytes), language)

        # Convert to WAV 16kHz mono
        wav_bytes = _convert_to_wav(file_bytes, filename)

        # Get audio duration
        audio = AudioSegment.from_file(io.BytesIO(wav_bytes), format="wav")
        duration = len(audio) / 1000.0

        start_time = time.time()

        # Call vLLM's OpenAI-compatible transcription endpoint
        async with httpx.AsyncClient(timeout=600) as client:
            files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
            data = {"model": MODEL_ID, "language": language, "response_format": "verbose_json"}

            resp = await client.post(
                f"{VLLM_BASE_URL}/v1/audio/transcriptions",
                files=files,
                data=data,
            )

        if resp.status_code != 200:
            # Fallback: try chat completions with audio input
            result = await _transcribe_via_chat(wav_bytes, language)
            if result is None:
                error_text = resp.text[:500]
                logger.error("vLLM transcription failed: %s", error_text)
                return JSONResponse(
                    content={"error": f"vLLM error ({resp.status_code}): {error_text}"},
                    status_code=502,
                )
        else:
            result = resp.json()

        elapsed = time.time() - start_time

        # Normalize response to Whisper format
        text = result.get("text", "")
        raw_segments = result.get("segments", [])

        segments = []
        for seg in raw_segments:
            segments.append({
                "start": seg.get("start", 0.0),
                "end": seg.get("end", 0.0),
                "text": seg.get("text", ""),
            })

        # If no segments returned, create one from full text
        if not segments and text:
            segments = [{"start": 0.0, "end": duration, "text": text}]

        logger.info(
            "Transcription complete: %d segments, %.1fs audio, %.1fs processing",
            len(segments), duration, elapsed,
        )

        return JSONResponse(content={
            "text": text,
            "segments": segments,
            "language": language,
            "duration": duration,
        })

    except Exception as exc:
        logger.error("Transcription error: %s", exc)
        return JSONResponse(content={"error": str(exc)}, status_code=500)


async def _transcribe_via_chat(wav_bytes: bytes, language: str) -> dict | None:
    """
    Fallback: transcribe via vLLM chat completions with audio input.
    Some vLLM versions expose audio via the chat API rather than /v1/audio/transcriptions.
    """
    import base64

    try:
        audio_b64 = base64.b64encode(wav_bytes).decode()

        payload = {
            "model": MODEL_ID,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "input_audio",
                            "input_audio": {
                                "data": audio_b64,
                                "format": "wav",
                            },
                        },
                        {
                            "type": "text",
                            "text": f"Transcribe this audio in {language}. Return only the transcription text.",
                        },
                    ],
                }
            ],
            "temperature": 0.0,
        }

        async with httpx.AsyncClient(timeout=600) as client:
            resp = await client.post(
                f"{VLLM_BASE_URL}/v1/chat/completions",
                json=payload,
            )

        if resp.status_code != 200:
            return None

        data = resp.json()
        text = data.get("choices", [{}])[0].get("message", {}).get("content", "")

        return {"text": text, "segments": []}

    except Exception as exc:
        logger.warning("Chat completions fallback failed: %s", exc)
        return None
