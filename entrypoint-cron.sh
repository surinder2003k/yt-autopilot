#!/bin/bash
# Entrypoint for GitHub Actions cron - generates config.toml from env vars

set -e

cat > /app/config.toml <<EOF
# Auto-generated from GitHub Actions secrets
log_level = "INFO"
listen_host = "0.0.0.0"
listen_port = 8080

[app]
api_key = ""

# LLM Provider - using OpenRouter (OpenAI-compatible)
llm_provider = "openai"
openai_api_key = "${OPENROUTER_API_KEY}"
openai_base_url = "https://openrouter.ai/api/v1"
openai_model_name = "nvidia/nemotron-3-super-120b-a12b:free"

# Video source
video_source = "pexels"
pexels_api_keys = ["${PEXELS_API_KEY}"]

# YouTube OAuth
youtube_refresh_token = "${YT_REFRESH_TOKEN}"
youtube_client_id = "${YT_CLIENT_ID}"
youtube_client_secret = "${YT_CLIENT_SECRET}"

# Telegram
telegram_bot_token = "${TELEGRAM_BOT_TOKEN}"
telegram_chat_id = "${TELEGRAM_CHAT_ID}"

# Other optional (empty by default)
moonshot_api_key = ""
shengsuanyun_api_key = ""
anthropic_api_key = ""
gemini_api_key = ""
deepseek_api_key = ""
qwen_api_key = ""
azure_api_key = ""
volcengine_api_key = ""
grok_api_key = ""
minimax_api_key = ""
mimo_api_key = ""
pixabay_api_keys = []
coverr_api_keys = []
wavespeed_api_keys = []
twelvelabs_api_keys = []
sonilo_api_key = ""
EOF

echo "config.toml generated"
exec python autopilot.py