"""
MoneyPrinterTurbo Auto-Pilot
- Picks a US-based topic (rotating niche list)
- Generates video via MoneyPrinterTurbo pipeline
- Uploads to YouTube (OAuth)
- Notifies via Telegram
- Logs every run to history.json (read by the monitoring dashboard)
Designed to run every 6 hours (Task Scheduler / cron / Render cron).
"""
import os
import sys
import json
import random
import pathlib
import datetime

ROOT = pathlib.Path(__file__).parent.resolve()
sys.path.insert(0, str(ROOT))

from loguru import logger

# ---------------- CONFIG from env / config file ----------------
ENV_FILE = ROOT / "automation.env"

def load_env():
    """Load key=value pairs from automation.env into os.environ (no override).
    On cloud (Render), env vars come from dashboard - file is optional."""
    if ENV_FILE.exists():
        for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

load_env()

TELEGRAM_BOT_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
YT_CLIENT_SECRET_FILE = os.environ.get("YT_CLIENT_SECRET_FILE", str(ROOT / "client_secret.json"))
UPLOAD_LANGUAGE = os.environ.get("UPLOAD_LANGUAGE", "en")  # en or hi

# Persisted files. In CI we override these to a mounted volume (/data) so the
# GitHub Actions workflow can commit them back to the repo for the dashboard.
STATE_FILE = pathlib.Path(os.environ.get("STATE_FILE", str(ROOT / "automation_state.json")))
HISTORY_FILE = pathlib.Path(os.environ.get("HISTORY_FILE", str(ROOT / "history.json")))

# US-based niches - high RPM categories (English only)
TOPICS = [
    # Finance / Money (highest RPM $10-30)
    {"t": "how the rich avoid paying taxes legally", "lang": "en", "tags": ["finance","money","taxes","rich"]},
    {"t": "5 side hustles that pay more than a job in 2026", "lang": "en", "tags": ["sidehustle","money","income"]},
    {"t": "why credit scores matter more than you think", "lang": "en", "tags": ["credit","finance","scores"]},
    {"t": "how compound interest makes millionaires", "lang": "en", "tags": ["investing","compound","money"]},
    {"t": "the 50/30/20 budget rule explained simply", "lang": "en", "tags": ["budget","finance","money"]},
    # Tech / AI (high RPM $8-20)
    {"t": "how AI is replacing jobs faster than you think", "lang": "en", "tags": ["ai","tech","jobs","future"]},
    {"t": "the truth about electric cars nobody tells you", "lang": "en", "tags": ["tesla","ev","cars","tech"]},
    {"t": "5 tech gadgets under $50 that feel illegal to own", "lang": "en", "tags": ["gadgets","tech","amazon"]},
    {"t": "why your smartphone slows down after 2 years", "lang": "en", "tags": ["smartphone","tech","planned"]},
    # Space / Science (medium RPM, viral)
    {"t": "what happens if you fall into a black hole", "lang": "en", "tags": ["space","blackhole","science"]},
    {"t": "the most dangerous places on earth", "lang": "en", "tags": ["earth","dangerous","geography"]},
    {"t": "why NASA is going back to the moon in 2027", "lang": "en", "tags": ["nasa","moon","space"]},
    {"t": "what would happen if the ocean disappeared", "lang": "en", "tags": ["ocean","science","earth"]},
    # Psychology / Facts (viral)
    {"t": "psychological tricks that actually work on people", "lang": "en", "tags": ["psychology","facts","mind"]},
    {"t": "signs someone is lying to you instantly", "lang": "en", "tags": ["psychology","lies","bodylanguage"]},
]

# Evergreen viral hashtags appended to EVERY post for reach/trending.
# Mixed pool so each upload gets a strong, varied discovery signal on
# YouTube Shorts, Reels and search (avoid identical-tag spam flags).
TRENDING_HASHTAGS = [
    "shorts", "viral", "trending", "fyp", "foryou", "youtubeshorts",
    "reels", "explore", "ai", "facts", "didyouknow", "viralfacts",
    "trendingnow", "foryoupage", "learnontiktok", "motivation",
]

def trending_block(vtype):
    """Return (description_hashtags, tag_list) of trending tags for a post.

    Shorts get the shorts-oriented tags first so vertical discovery wins;
    normal videos get the broader viral set. Deterministic per call so the
    dashboard and the upload always agree.
    """
    tags = list(TRENDING_HASHTAGS)
    if vtype == "short":
        # push shorts-relevant tags to the front for vertical reach
        tags.sort(key=lambda t: 0 if t in ("shorts", "youtubeshorts", "reels", "fyp") else 1)
    return tags

VOICE_MAP = {
    "en": "en-US-ChristopherNeural",      # deep American male
    "hi": "hi-IN-MadhurNeural",
}


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"used_topics": [], "last_run": None}


def save_state(state):
    state["last_run"] = datetime.datetime.now().isoformat()
    STATE_FILE.write_text(json.dumps(state, indent=2))


def load_history():
    """Return the list of run events (newest last)."""
    if HISTORY_FILE.exists():
        try:
            data = json.loads(HISTORY_FILE.read_text())
            if isinstance(data, list):
                return data
        except Exception:
            pass
    return []


def append_history(event):
    """Append a run event to history.json. Never raises - logging must not
    break the upload pipeline."""
    try:
        events = load_history()
        events.append(event)
        # keep last 500 events to bound file size
        if len(events) > 500:
            events = events[-500:]
        HISTORY_FILE.write_text(json.dumps(events, indent=2))
    except Exception as e:
        logger.warning(f"could not write history: {e}")


def pick_topic(state):
    unused = [i for i, _ in enumerate(TOPICS) if i not in state["used_topics"]]
    if not unused:  # all used -> reset
        state["used_topics"] = []
        unused = list(range(len(TOPICS)))
    idx = random.choice(unused)
    state["used_topics"].append(idx)
    return idx, TOPICS[idx]


def pick_aspect(state):
    """Shorts-only automation (per user request). Always 9:16 vertical Short.

    YouTube treats a vertical (9:16) video as a Short. Normal 7-15 min videos
    now run on a SEPARATE 12h schedule via normal_video.py / normal_video.yml.
    """
    return "9:16", "short"


# ~1 minute Short: ~140-160 spoken words ≈ 1 min at ~150 wpm.
SHORT_VIDEO_SCRIPT_PROMPT = (
    "Write a punchy, fast-paced SHORT script of 140-160 words (3 short "
    "paragraphs, hooks in the first line, no fluff). This is a ~1 minute "
    "vertical reel — keep it tight and energetic."
)


def generate_video(topic_entry, aspect="9:16", vtype="short"):
    from app.models.schema import VideoParams
    from app.services import task as task_service
    import uuid

    from llm_fallback import generate_script_with_fallback

    task_id = "auto_" + str(uuid.uuid4())[:8]
    lang = topic_entry["lang"]
    if vtype == "normal":
        # 16:9 landscape, long script -> 7-10 min video
        paragraph_number = 10
        script_prompt = NORMAL_VIDEO_SCRIPT_PROMPT
        clip_duration = 5
    else:
        # 9:16 Short, ~1 minute reel.
        # ~150 spoken words at ~150 wpm ≈ 1 minute of audio.
        paragraph_number = 3
        script_prompt = SHORT_VIDEO_SCRIPT_PROMPT
        clip_duration = 3

    # Pre-generate the script with multi-provider fallback (OpenRouter ->
    # OpenCode Zen -> Gemini -> local template). Inject so MPT never makes
    # its own (rate-limited) LLM call.
    script = generate_script_with_fallback(
        video_subject=topic_entry["t"],
        language="English",
        paragraph_number=paragraph_number,
        video_script_prompt=script_prompt,
    )
    logger.info(f"script ready ({len(script)} chars) for topic: {topic_entry['t']}")
    params = VideoParams(
        video_subject=topic_entry["t"],
        video_script=script,
        video_terms=[topic_entry["t"], "facts", "cinematic", "technology", "nature"],
        voice_name=VOICE_MAP[lang],
        video_aspect=aspect,
        video_clip_duration=clip_duration,
        paragraph_number=paragraph_number,
        video_script_prompt=script_prompt,
        n_threads=2,
        video_source="pexels",
        video_language="English",         # force English script for US audience
        font_name="BeVietnamPro-Bold.ttf",  # bundled font (arialbd.ttf not shipped)
        text_fore_color="#FFFFFF",
        stroke_color="#000000",
        stroke_width=1.8,
    )
    logger.info(f"generating video for topic: {topic_entry['t']}")
    result = task_service.start(task_id, params, stop_at="video")
    if result and result.get("state") == -1:
        raise RuntimeError(f"video generation failed: {result.get('error')}")
    videos = result.get("videos", [])
    if not videos:
        raise RuntimeError("no video produced")
    return task_id, videos[0], result


def make_title_description(topic_entry, vtype="short"):
    title = topic_entry["t"].title()[:95]
    # Topic-specific tags + evergreen trending hashtags for reach.
    trending = trending_block(vtype)
    all_tags = list(dict.fromkeys(list(topic_entry["tags"]) + trending))  # dedupe, keep order
    # Description: a couple of hook lines + full hashtag wall (helps trending).
    hashtag_line = " ".join(f"#{t}" for t in all_tags)
    desc = (
        f"{topic_entry['t'].title()}\n\n"
        f"🔥 Like & Subscribe for more!\n\n"
        f"{hashtag_line}\n\n"
        f"#shorts #viral #trending"
    )
    return title, desc, all_tags


def upload_to_youtube(video_path, title, desc, tags):
    """Upload MP4 to YouTube.
    Cloud mode: YT_REFRESH_TOKEN env var (long-lived refresh token).
    Local mode: yt_token.pickle or interactive browser flow."""
    try:
        from google.oauth2.credentials import Credentials
        from google.auth.transport.requests import Request
        from googleapiclient.discovery import build
        from googleapiclient.http import MediaFileUpload
        import pickle
    except ImportError:
        raise RuntimeError("google api libs missing - pip install google-api-python-client google-auth-oauthlib")

    scopes = ["https://www.googleapis.com/auth/youtube.upload"]
    creds = None

    # 1) Cloud: refresh token from env
    rt = os.environ.get("YT_REFRESH_TOKEN", "").strip()
    cid = os.environ.get("YT_CLIENT_ID", "").strip()
    csec = os.environ.get("YT_CLIENT_SECRET", "").strip()
    if rt and cid and csec:
        creds = Credentials(
            token=None,
            refresh_token=rt,
            client_id=cid,
            client_secret=csec,
            token_uri="https://oauth2.googleapis.com/token",
            scopes=scopes,
        )
        creds.refresh(Request())
    else:
        # 2) Local: pickled token or interactive flow
        token_file = ROOT / "yt_token.pickle"
        if token_file.exists():
            with open(token_file, "rb") as f:
                creds = pickle.load(f)
        if not creds or not creds.valid:
            if creds and creds.expired and creds.refresh_token:
                creds.refresh(Request())
            else:
                from google_auth_oauthlib.flow import InstalledAppFlow
                flow = InstalledAppFlow.from_client_secrets_file(YT_CLIENT_SECRET_FILE, scopes)
                creds = flow.run_local_server(port=8089)
            with open(token_file, "wb") as f:
                pickle.dump(creds, f)

    yt = build("youtube", "v3", credentials=creds)
    body = {
        "snippet": {
            "title": title,
            "description": desc,
            "tags": tags,
            "categoryId": "22",  # People & Blogs; use 27=Education, 28=Sci/Tech
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
        },
    }
    media = MediaFileUpload(str(video_path), chunksize=-1, resumable=True)
    req = yt.videos().insert(part=",".join(body.keys()), body=body, media_body=media)
    response = None
    while response is None:
        status, response = req.next_chunk()
        if status:
            logger.info(f"upload progress: {int(status.progress() * 100)}%")
    logger.success(f"uploaded: https://youtube.com/watch?v={response['id']}")
    return response["id"]


def notify_telegram(message):
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        logger.warning("telegram not configured, skipping notification")
        return
    import urllib.request, urllib.parse
    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = urllib.parse.urlencode({"chat_id": TELEGRAM_CHAT_ID, "text": message}).encode()
    try:
        urllib.request.urlopen(url, data=data, timeout=15)
        logger.info("telegram notification sent")
    except Exception as e:
        logger.warning(f"telegram failed: {e}")


def main():
    logger.info("=== Auto-Pilot starting ===")
    state = load_state()
    idx, topic_entry = pick_topic(state)
    aspect, vtype = pick_aspect(state)
    vlabel = "📱 Short (Reel)" if vtype == "short" else "🖥️ Normal Video"
    logger.info(f"this run will produce a {vtype} ({aspect})")
    ts = datetime.datetime.now(datetime.timezone.utc).isoformat()

    try:
        task_id, video_path, result = generate_video(topic_entry, aspect=aspect, vtype=vtype)
        title, desc, tags = make_title_description(topic_entry, vtype=vtype)
        video_id = upload_to_youtube(video_path, title, desc, tags)
        notify_telegram(f"🎬 Video posted! ({vlabel})\n\n📌 {title}\n🔗 https://youtube.com/watch?v={video_id}\n📁 Task: {task_id}")
        save_state(state)
        append_history({
            "ts": ts,
            "status": "success",
            "topic_index": idx,
            "topic": topic_entry["t"],
            "title": title,
            "video_id": video_id,
            "url": f"https://youtube.com/watch?v={video_id}",
            "tags": tags,
            "task_id": task_id,
            "video_type": vtype,
            "aspect": aspect,
        })
        logger.success("=== Auto-Pilot run complete ===")
    except Exception as e:
        err = str(e)
        logger.error(f"auto-pilot failed: {e}")
        notify_telegram(f"⚠️ Video automation FAILED ({vlabel}):\n{err[:500]}\nTopic was: {topic_entry['t']}")
        save_state(state)
        append_history({
            "ts": ts,
            "status": "failed",
            "topic_index": idx,
            "topic": topic_entry["t"],
            "error": err[:500],
            "task_id": None,
            "video_type": vtype,
            "aspect": aspect,
        })
        sys.exit(1)


if __name__ == "__main__":
    main()
