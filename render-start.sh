#!/bin/bash
# MoneyPrinterTurbo - Render.com startup script
# Generates config.toml from environment variables at container start,
# then launches the FastAPI server on $PORT.

set -e
cd "$(dirname "$0")"

PORT="${PORT:-8080}"
API_KEY="${MPT_API_KEY:-}"

cat > config.toml <<EOF
log_level = "INFO"
listen_host = "0.0.0.0"
listen_port = ${PORT}

[app]
api_key = "${API_KEY}"
hide_config = false
video_source = "pexels"
pexels_api_keys = ["${PEXELS_API_KEY}"]
pixabay_api_keys = []
enable_redis = false

llm_provider = "openai"
openai_api_key = "${OPENROUTER_API_KEY}"
openai_base_url = "https://openrouter.ai/api/v1"
openai_model_name = "${LLM_MODEL:-nvidia/nemotron-3-super-120b-a12b:free}"

[whisper]

[proxy]

[azure]

[siliconflow]

[minimax_tts]

[elevenlabs]

[chatterbox]

[fish_audio]

[ui]
hide_log = false
EOF

# Resolve project venv python if present (local test), else system python
if [ -x "venv/Scripts/python.exe" ]; then
  PY="venv/Scripts/python.exe"
elif [ -x "venv/bin/python" ]; then
  PY="venv/bin/python"
else
  PY="python"
fi

echo "config.toml generated. Starting server on port ${PORT}..."
exec "$PY" -m uvicorn app.asgi:app --host 0.0.0.0 --port "${PORT}"
