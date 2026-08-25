#!/usr/bin/env python3
"""
normal_video.py — generates & uploads a LONG-FORM (7-15 min) normal YouTube video.

Runs on a SEPARATE 12h schedule from the 6h Shorts automation.

Key difference from autopilot.py (Shorts):
  - This uses a CHUNKED TTS approach. The 10+ paragraph script is synthesized
    ONE PARAGRAPH AT A TIME via edge-tts (each chunk is short, never hits the
    30s stream timeout), then the audio chunks are concatenated with pydub and
    passed to MoneyPrinterTurbo as `audio_file` (so MPT skips its own TTS step).
  - This avoids the edge_tts "stream timed out after 30s" failure that happens
    on long scripts when relying on MPT's single-shot TTS.
"""
import os, sys, json, time, asyncio, tempfile, random
from pathlib import Path

ROOT = Path(__file__).parent.resolve()

# ---- MPT imports ----
from app.models.schema import VideoParams
from app.services import task as task_service
from app.utils import utils

# Telegram notifier lives in autopilot.py
sys.path.insert(0, str(ROOT))
from autopilot import notify_telegram

# ---- Topic pool for normal 7-15 min videos ----
NORMAL_TOPICS = [
    {"t": "the dark history of the internet and how it changed the world", "lang": "en", "tags": ["internet","history","tech"]},
    {"t": "how ancient civilizations predicted the future with shocking accuracy", "lang": "en", "tags": ["history","ancient","mystery"]},
    {"t": "the psychology of why we procrastinate and how to actually stop", "lang": "en", "tags": ["psychology","productivity","mind"]},
    {"t": "the real reason titanic sank — conspiracy theories explained", "lang": "en", "tags": ["titanic","conspiracy","history"]},
    {"t": "how billionaires think differently from ordinary people", "lang": "en", "tags": ["money","success","psychology"]},
    {"t": "the untold story of the first computer ever built", "lang": "en", "tags": ["computer","tech","history"]},
    {"t": "why the bermuda triangle is still a mystery to science", "lang": "en", "tags": ["bermuda","mystery","science"]},
    {"t": "the secret lives of the world's most dangerous dictators", "lang": "en", "tags": ["history","politics","war"]},
    {"t": "how the stock market actually works for beginners", "lang": "en", "tags": ["stockmarket","money","finance"]},
    {"t": "the science of sleep and what happens to your brain at night", "lang": "en", "tags": ["sleep","science","health"]},
]

NORMAL_VIDEO_SCRIPT_PROMPT = (
    "Write a DETAILED, long-form documentary-style script of 1500-2200 words "
    "(at least 12 substantial paragraphs). Cover the topic in depth with "
    "background, surprising facts, real examples, and a strong narrative arc. "
    "Use clear paragraphs separated by blank lines. Do NOT use markdown or "
    "headings. Write engaging, spoken-language prose a narrator would read aloud."
)

# Trending hashtags for reach
TRENDING_NORMAL = [
    "shorts","viral","trending","fyp","foryou","youtube","explore","ai",
    "facts","didyouknow","viralfacts","trendingnow","foryoupage","motivation",
    "knowledge","learning","documentary","storytime","informative","education",
    "top10","interestingfacts",
]

HISTORY_FILE = os.environ.get("HISTORY_FILE", "history.json")
STATE_FILE = os.environ.get("STATE_FILE", "normal_state.json")  # separate from Shorts' automation_state.json

def load_used_topics():
    try:
        with open(STATE_FILE) as f:
            return set(json.load(f).get("used_topics", []))
    except Exception:
        return set()

def save_used_topics(used):
    state = {"used_topics": list(used), "last_run": time.strftime("%Y-%m-%dT%H:%M:%S"), "last_aspect": "16:9"}
    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

def pick_topic():
    used = load_used_topics()
    avail = [i for i in range(len(NORMAL_TOPICS)) if i not in used]
    if not avail:
        used = set()
        avail = list(range(len(NORMAL_TOPICS)))
    idx = random.choice(avail)
    used.add(idx)
    save_used_topics(used)
    return NORMAL_TOPICS[idx]

def make_title_description(topic_entry):
    title = topic_entry["t"].title()[:95]
    tags = list(topic_entry["tags"]) + TRENDING_NORMAL
    tags = tags[:58]  # YouTube allows max 500 chars / 60 tags
    desc = f"{topic_entry['t']}\n\n#{' #'.join(tags)}\n\n🔥 Like & Subscribe for more!\n\n#ai #facts #viralfacts #didyouknow #trendingnow"
    return title, desc, tags

# ---- Chunked TTS (the "alag tarika") ----
import edge_tts

VOICE = "en-US-ChristopherNeural"

async def synth_chunk(text, out_path, voice=VOICE, rate="+0%"):
    comm = edge_tts.Communicate(text, voice, rate=rate)
    await comm.save(out_path)

def synthesize_script_chunked(script_text, final_path):
    """Synthesize a long script paragraph-by-paragraph and concat into one mp3.

    Uses ffmpeg (already present in the MPT Docker image) to concatenate the
    per-paragraph mp3 chunks — no extra dependency (pydub) needed.
    """
    import subprocess
    paragraphs = [p.strip() for p in script_text.split("\n\n") if p.strip()]
    if not paragraphs:
        paragraphs = [script_text]
    tmp_files = []
    for i, para in enumerate(paragraphs):
        tmp = os.path.join(tempfile.gettempdir(), f"norm_chunk_{i}.mp3")
        try:
            asyncio.run(synth_chunk(para, tmp))
        except Exception as e:
            print(f"[WARN] chunk {i} TTS failed ({e}), retrying once")
            asyncio.run(synth_chunk(para, tmp))
        if os.path.isfile(tmp):
            tmp_files.append(tmp)
    if not tmp_files:
        raise RuntimeError("all TTS chunks failed")
    if len(tmp_files) == 1:
        os.replace(tmp_files[0], final_path)
    else:
        # ffmpeg concat demuxer
        list_path = os.path.join(tempfile.gettempdir(), "norm_chunks.txt")
        with open(list_path, "w") as lf:
            for tf in tmp_files:
                lf.write(f"file '{tf}'\n")
        subprocess.run(
            ["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", list_path,
             "-c", "copy", final_path],
            check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
    for tf in tmp_files:
        try: os.remove(tf)
        except Exception: pass
    try: os.remove(os.path.join(tempfile.gettempdir(), "norm_chunks.txt"))
    except Exception: pass
    return final_path

def generate_video(script, title, desc, tags):
    from app.models.schema import VideoParams
    from app.services import task as task_service
    import uuid

    task_id = "norm_" + str(uuid.uuid4())[:8]
    audio_path = os.path.join(ROOT, f"normal_audio_{task_id}.mp3")
    print(f"[INFO] synthesizing {len(script)} chars of audio (chunked)...")
    synthesize_script_chunked(script, audio_path)
    print(f"[INFO] audio ready: {audio_path} ({os.path.getsize(audio_path)} bytes)")

    params = VideoParams(
        video_subject=title,
        video_script=script,
        video_terms=[title, "facts", "cinematic", "technology", "nature"],
        video_aspect="16:9",   # 16:9 landscape normal video
        video_language="en",
        voice_name="female_or_male_optimized",
        bgm_type="random",
        bgm_volume=0.2,
        video_concat_mode="random",
        video_clip_duration=5,
        video_transition_mode="FadeIn",
        video_count=1,
        custom_audio_file=audio_path,     # <-- bypass MPT TTS, use our chunked audio
    )
    result = task_service.start(task_id, params, stop_at="video", allow_server_file_input=True)
    if result and result.get("state") == -1:
        raise RuntimeError(f"video generation failed: {result.get('error')}")
    videos = result.get("videos", []) if result else []
    if not videos:
        raise RuntimeError("no video produced")
    video_path = videos[0]
    if os.path.isfile(audio_path):
        try: os.remove(audio_path)
        except Exception: pass
    return video_path

def main():
    print("=== Normal Video (7-15 min) run start ===")
    topic_entry = pick_topic()
    print(f"[INFO] topic: {topic_entry['t']}")

    # 1) Generate long script (with multi-provider fallback -> local template)
    from llm_fallback import generate_script_with_fallback
    script = generate_script_with_fallback(
        video_subject=topic_entry["t"],
        language="English",
        paragraph_number=12,
        video_script_prompt=NORMAL_VIDEO_SCRIPT_PROMPT,
    )
    if not script:
        print("[ERROR] script generation failed (even local template)")
        sys.exit(1)
    print(f"[INFO] script length: {len(script)} chars / ~{len(script.split())} words")

    # 2) Title/desc/tags with trending hashtags
    title, desc, tags = make_title_description(topic_entry)
    print(f"[INFO] title: {title}")

    # 3) Generate (chunked TTS bypasses timeout) -> local mp4 path
    video_path = generate_video(script, title, desc, tags)
    print(f"[INFO] video generated: {video_path}")

    # 4) Upload to YouTube
    from autopilot import upload_to_youtube
    video_id = upload_to_youtube(video_path, title, desc, tags)
    url = f"https://youtube.com/watch?v={video_id}"
    print(f"[INFO] uploaded: {url}")

    # 5) Telegram alert
    try:
        from autopilot import notify_telegram, append_history
        notify_telegram(
            f"🖥️ NORMAL VIDEO (7-15 min) posted!\n\n📌 {title}\n🔗 {url}\n\n#normal #longform"
        )
        append_history({
            "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "status": "success",
            "topic": topic_entry["t"],
            "title": title,
            "video_id": video_id,
            "url": url,
            "tags": tags,
            "task_id": None,
            "video_type": "normal",
            "aspect": "16:9",
        })
    except Exception as e:
        print(f"[WARN] telegram/history notify failed: {e}")

    print("=== Normal Video run complete ===")

if __name__ == "__main__":
    main()
