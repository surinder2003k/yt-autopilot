# 🎬 YT Auto-Pilot

Fully automated **YouTube Shorts** pipeline. Every 6 hours it picks a US-based
niche topic, generates a Short with AI (script → Pexels footage → TTS → render),
uploads it to YouTube, and pings Telegram.

> **Live Dashboard:** https://yt-autopilot-3cayv4nv7-sendltestmaill-3608s-projects.vercel.app
> **Live Channel:** [@DesiFragLord](https://www.youtube.com/@DesiFragLord)

---

## ✨ What it does

| Step | Tool | Notes |
|------|------|-------|
| 1. Topic | **OpenRouter** (nvidia/nemotron-3-super-120b-a12b:free) | Picks from curated US niches |
| 2. Script | Same LLM | Hindi/English bilingual script |
| 3. Footage | **Pexels API** (free) | Vertical clips, auto-download |
| 4. Voice | **edge-tts** (free, offline) | Hindi + English mixed |
| 5. Render | **MoviePy** + **Playwright** (headless Chrome) | 9:16, captions, watermark |
| 6. Upload | **YouTube Data API v3** (OAuth refresh token) | Shorts format, tags, description |
| 7. Notify | **Telegram Bot** | ✅ success / ❌ fail only |

---

## 🔧 Setup (if you want your own)

### Prerequisites
- **GitHub repo** (this one, forked)
- **GitHub Actions secrets** (add all 7 below):
  - `PEXELS_API_KEY` — Pexels free API key
  - `OPENROUTER_API_KEY` — OpenRouter free tier key
  - `TELEGRAM_BOT_TOKEN` — BotFather token
  - `TELEGRAM_CHAT_ID` — Your chat ID
  - `YT_REFRESH_TOKEN` — YouTube OAuth refresh token
  - `YT_CLIENT_ID` — Google Cloud OAuth client ID
  - `YT_CLIENT_SECRET` — Google Cloud OAuth client secret
- **Vercel project** linked to `dashboard/` folder (auto-deploy on push)

### How it runs
1. GitHub Actions cron (`0 */6 * * *`) fires
2. Docker container runs `autopilot.py` (generates config from env vars)
3. Video built → uploaded to YouTube → history.json updated → pushed back
4. Telegram gets one-line result

---

## 📊 Monitoring

- **Dashboard** (Vercel): live history, status, YouTube links
- **GitHub Actions**: run logs, manual trigger, history commits
- **Telegram**: only post/fail notifications

---

## 📝 Files of interest

| File | Purpose |
|------|---------|
| `autopilot.py` | Standalone pipeline (cron entrypoint) |
| `Dockerfile.cron` | Container for GitHub Actions run |
| `entrypoint-cron.sh` | Generates `config.toml` from env vars |
| `requirements.txt` | Python deps |
| `.github/workflows/autopilot.yml` | Cron + commit-back workflow |
| `dashboard/` | Next.js 15 read-only monitor |
| `history.json` | Auto-maintained run log (updated by workflow) |

---

## 🔐 Security

- **No secrets in repo** — all keys in GitHub Actions secrets
- **Dashboard read-only** — only fetches public `history.json`
- **YouTube OAuth** uses refresh token (short-lived access tokens)
- **Telegram bot** only sends, never receives commands

---

*Built with free tiers only: GitHub Actions (cron), OpenRouter (free model), Pexels (free footage), edge-tts (free TTS), Vercel (free hosting).*