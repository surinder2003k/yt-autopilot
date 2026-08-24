"""
MoneyPrinterTurbo Auto-Pilot
- Picks a US-based topic (rotating niche list)
- Generates video via MoneyPrinterTurbo pipeline
- Uploads to YouTube (OAuth)
- Notifies via Telegram
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
STATE_FILE = ROOT / "automation_state.json"

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


def pick_topic(state):
    unused = [i for i, _ in enumerate(TOPICS) if i not in state["used_topics"]]
    if not unused:  # all used -> reset
        state["used_topics"] = []
        unused = list(range(len(TOPICS)))
    idx = random.choice(unused)
    state["used_topics"].append(idx)
    return idx, TOPICS[idx]


def generate_video(topic_entry):
    from app.models.schema import VideoParams
    from app.services import task as task_service
    import uuid

    task_id = "auto_" + str(uuid.uuid4())[:8]
    lang = topic_entry["lang"]
    params = VideoParams(
        video_subject=topic_entry["t"],
        voice_name=VOICE_MAP[lang],
        video_aspect="9:16",
        video_clip_duration=3,
        paragraph_number=1,
        n_threads=2,
        video_source="pexels",
        video_language="English",         # force English script for US audience
        font_name="arialbd.ttf",          # Arial Bold - clean English subtitles
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


def make_title_description(topic_entry):
    title = topic_entry["t"].title()[:95]
    tags = topic_entry["tags"]
    desc = f"{topic_entry['t']}\n\n#{' #'.join(tags)}\n\nGenerated with AI."
    return title, desc, tags


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

    try:
        task_id, video_path, result = generate_video(topic_entry)
        title, desc, tags = make_title_description(topic_entry)
        video_id = upload_to_youtube(video_path, title, desc, tags)
        notify_telegram(f"🎬 Video posted!\n\n📌 {title}\n🔗 https://youtube.com/watch?v={video_id}\n📁 Task: {task_id}")
        save_state(state)
        logger.success("=== Auto-Pilot run complete ===")
    except Exception as e:
        logger.error(f"auto-pilot failed: {e}")
        notify_telegram(f"⚠️ Video automation FAILED:\n{str(e)[:500]}\nTopic was: {topic_entry['t']}")
        save_state(state)
        sys.exit(1)


if __name__ == "__main__":
    main()
