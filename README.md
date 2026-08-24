# 🎬 YT Auto-Pilot

Fully automated **YouTube Shorts** pipeline. Every 6 hours it picks a US-based
niche topic, generates a Short with AI (script → Pexels footage → TTS → render),
uploads it to YouTube, and pings Telegram.

---

## ✨ What it does

| Stage | Tool |
|-------|------|
| Topic pick | rotating US niche list (finance / AI / space / psych) |
| Script | OpenRouter free model `nvidia/nemotron-3-super-120b-a12b:free` |
| Footage | Pexels stock videos |
| Voice | Edge-TTS (`en-US-ChristopherNeural`) |
| Render | MoneyPrinterTurbo (1080×1920, 9:16) |
| Upload | YouTube Data API (OAuth refresh token) |
| Notify | Telegram **only** on success or failure |

## ⏰ Schedule

GitHub Actions cron — `0 */6 * * *` (UTC) → **5:30, 11:30, 17:30, 23:30 IST**.
Manual trigger also available under Actions → "YouTube Auto-Pilot" → Run workflow.

## 🖥️ Dashboard (read-only)

A Next.js monitor deployed on Vercel. It reads `history.json` (committed back by
the pipeline after every run) and shows:

- Total runs / posted / failed / success rate
- Live pipeline health banner
- Full run history with links to each video

Open 👉 **https://yt-autopilot.vercel.app**

## 🔧 Secrets (GitHub → Settings → Secrets → Actions)

| Secret | Purpose |
|--------|---------|
| `PEXELS_API_KEY` | stock footage |
| `OPENROUTER_API_KEY` | free LLM for scripts |
| `TELEGRAM_BOT_TOKEN` | notification bot |
| `TELEGRAM_CHAT_ID` | your chat |
| `YT_REFRESH_TOKEN` | YouTube upload OAuth |
| `YT_CLIENT_ID` | Google Cloud OAuth |
| `YT_CLIENT_SECRET` | Google Cloud OAuth |

## 📁 Repo layout

```
autopilot.py              # pipeline entrypoint (runs once per cron trigger)
Dockerfile.cron           # lightweight Playwright image for CI
entrypoint-cron.sh        # generates config.toml from secrets, runs autopilot
requirements.txt          # python deps (incl. youtube upload libs)
history.json              # run log (read by dashboard)
dashboard/                # Next.js read-only monitor (Vercel)
vercel.json               # Vercel deploy config
.github/workflows/        # GitHub Actions: run + commit history
```

## 🚀 Local run (optional)

```bash
pip install -r requirements.txt
export PEXELS_API_KEY=... OPENROUTER_API_KEY=... YT_REFRESH_TOKEN=...  # etc.
python autopilot.py
```

## 📜 License

MIT — automate responsibly.
