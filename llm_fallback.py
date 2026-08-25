"""
llm_fallback.py — Robust script generation with multi-provider fallback.

Tier order (configurable via env, all OpenAI-compatible chat completions):
  1. OpenRouter  — free models (OPENROUTER_API_KEY)
  2. OpenCode Zen — free models (OPENCODE_ZEN_API_KEY / OPENCODE_API_KEY)
  3. Gemini      — free models (GEMINI_API_KEY / GOOGLE_API_KEY)
  4. LOCAL TEMPLATE — no API needed, always works (guarantees a post)

If every provider is rate-limited / key missing, we fall through to a
locally generated template script so the pipeline NEVER dies silently and a
video is still produced + posted.
"""

import os
import sys

try:
    from openai import OpenAI
    _HAS_OPENAI = True
except Exception:
    _HAS_OPENAI = False


# ---- Free model catalogs (per provider) -------------------------------------
# Live-verified 2026-08-25 via GET /api/v1/models (only currently-served slugs)
OPENROUTER_MODELS = [
    "nvidia/nemotron-3-ultra-550b-a55b:free",
    "z-ai/glm-5.2:free",
    "google/gemma-4-31b-it:free",
    "google/gemma-4-26b-a4b-it:free",
    "minimax/minimax-m3:free",
    "minimax/minimax-m2.7:free",
    "nvidia/nemotron-3-super-120b-a12b:free",
    "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
    "liquid/lfm-2.5-2.6b:free",
    "dots-studio/dots-3-note-preview:free",
]

OPENCODE_ZEN_MODELS = [
    "deepseek-v4-flash-free",
    "mimo-v2.5-free",
    "qwen3.6-plus-free",
    "minimax-m3-free",
    "nemotron-3-ultra-free",
    "north-mini-code-free",
]

GEMINI_MODELS = [
    "gemini-2.5-flash",
    "gemini-2.0-flash",
    "gemma-2-9b-it",
]

PROVIDER_ENDPOINTS = {
    "openrouter": ("https://openrouter.ai/api/v1", "OPENROUTER_API_KEY"),
    "opencode_zen": ("https://opencode.ai/zen/v1",
                     "OPENCODE_ZEN_API_KEY"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai",
               "GEMINI_API_KEY"),
}


def _call_openai(base_url, api_key, model, prompt, timeout=120):
    if not _HAS_OPENAI:
        raise RuntimeError("openai SDK not available")
    client = OpenAI(base_url=base_url, api_key=api_key, timeout=timeout)
    resp = client.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        temperature=0.8,
    )
    text = resp.choices[0].message.content
    if not text or not text.strip():
        raise RuntimeError("empty completion")
    return text.strip()


def _local_template(video_subject, paragraph_number, language="English"):
    """Generate a decent facts-style script with NO external API."""
    subject = video_subject.strip()
    paras = []
    hooks = [
        f"Did you know that {subject} is way more interesting than people think?",
        f"Here's something about {subject} that nobody talks about.",
        f"The truth about {subject} will surprise you.",
        f"Most people get {subject} completely wrong — here's why.",
        f"Scientists just revealed a wild fact about {subject}.",
    ]
    facts = [
        f"First, {subject} has a history that goes back centuries and keeps evolving.",
        f"Second, the way {subject} works is simpler than it looks once you break it down.",
        f"Third, experts agree that {subject} plays a bigger role in daily life than we notice.",
        f"Another key point: small changes around {subject} can make a huge difference.",
        f"Interestingly, {subject} connects to many other fields you would never expect.",
        f"Studies show that understanding {subject} helps you make smarter decisions.",
        f"There are plenty of myths about {subject} — most of them are just not true.",
        f"Over time, {subject} has shaped culture, technology, and even habits.",
        f"The future of {subject} looks nothing like its past.",
        f"One underrated fact: {subject} is easier to start with than most beginners assume.",
    ]
    paras.append(hooks[0])
    idx = 0
    while len(paras) < paragraph_number:
        paras.append(facts[idx % len(facts)])
        idx += 1
    paras.append(
        f"So that's the real story behind {subject}. "
        f"If you learned something new, hit like and subscribe for more!"
    )
    return "\n\n".join(paras)


def generate_script_with_fallback(video_subject, language="English",
                                  paragraph_number=3, video_script_prompt="",
                                  **kwargs):
    """Try LLM providers in order; fall back to a local template.

    Returns a script string. Never raises on provider errors — only the
    final template path can't fail.
    """
    prompt = (
        f"{video_script_prompt}\n\n"
        f"Topic: {video_subject}\n"
        f"Language: {language}\n"
        f"Number of paragraphs: {paragraph_number}\n"
        f"Write the script now."
    )

    # 1) OpenRouter
    if os.getenv("OPENROUTER_API_KEY"):
        for m in OPENROUTER_MODELS:
            try:
                print(f"[FALLBACK] trying OpenRouter -> {m}")
                return _call_openai(PROVIDER_ENDPOINTS["openrouter"][0],
                                    os.getenv("OPENROUTER_API_KEY"), m, prompt)
            except Exception as e:
                print(f"[FALLBACK] OpenRouter {m} failed: {e}")
    else:
        print("[FALLBACK] OPENROUTER_API_KEY not set, skipping")

    # 2) OpenCode Zen
    zen_key = os.getenv("OPENCODE_ZEN_API_KEY") or os.getenv("OPENCODE_API_KEY")
    if zen_key:
        for m in OPENCODE_ZEN_MODELS:
            try:
                print(f"[FALLBACK] trying OpenCode Zen -> {m}")
                return _call_openai(PROVIDER_ENDPOINTS["opencode_zen"][0],
                                    zen_key, m, prompt)
            except Exception as e:
                print(f"[FALLBACK] OpenCode Zen {m} failed: {e}")
    else:
        print("[FALLBACK] OPENCODE_ZEN_API_KEY not set, skipping")

    # 3) Gemini
    gem_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if gem_key:
        for m in GEMINI_MODELS:
            try:
                print(f"[FALLBACK] trying Gemini -> {m}")
                return _call_openai(PROVIDER_ENDPOINTS["gemini"][0],
                                    gem_key, m, prompt)
            except Exception as e:
                print(f"[FALLBACK] Gemini {m} failed: {e}")
    else:
        print("[FALLBACK] GEMINI_API_KEY not set, skipping")

    # 4) Local template — always works
    print("[FALLBACK] all providers skipped/exhausted -> LOCAL TEMPLATE script")
    return _local_template(video_subject, paragraph_number, language)


if __name__ == "__main__":
    out = generate_script_with_fallback(
        "Why the ocean is salty", "English", 3,
        "Write a punchy short script.")
    print("----\n" + out)
